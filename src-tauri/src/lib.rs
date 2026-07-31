mod commands;
mod light_wallet;
mod names;
mod registry;
mod resolve;
mod url;

use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

/// Event payload for frontend navigation from OS deep links.
#[derive(Clone, serde::Serialize)]
struct DeepLinkEvent {
    urls: Vec<String>,
}

fn emit_deep_links(app: &tauri::AppHandle, urls: Vec<String>) {
    // Keep only real grid:// targets (drop empty / non-scheme argv noise).
    let urls: Vec<String> = urls
        .into_iter()
        .map(|u| u.trim().to_string())
        .filter(|u| {
            let lower = u.to_ascii_lowercase();
            lower.starts_with("grid://") || lower.starts_with("grid:")
        })
        .collect();
    if urls.is_empty() {
        return;
    }
    let _ = app.emit("mesh://open", DeepLinkEvent { urls: urls.clone() });
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = win.show();
    }
    eprintln!("[MESH] deep link: {urls:?}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single instance first — forwards deep links to the running MESH process
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls: Vec<String> = argv
                .into_iter()
                .filter(|a| {
                    let lower = a.to_ascii_lowercase();
                    lower.starts_with("grid:") || lower.starts_with("grid://")
                })
                .collect();
            if !urls.is_empty() {
                emit_deep_links(app, urls);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                let list: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                emit_deep_links(app.handle(), list);
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let list: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                emit_deep_links(&handle, list);
            });

            // Register at runtime on platforms that allow it (not macOS).
            #[cfg(any(windows, target_os = "linux"))]
            {
                if let Err(e) = app.deep_link().register_all() {
                    eprintln!("[MESH] deep-link register_all failed: {e}");
                }
                if let Err(e) = app.deep_link().register("grid") {
                    eprintln!("[MESH] deep-link register(grid) failed: {e}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::normalize_url,
            commands::navigate,
            commands::list_names,
            commands::set_name,
            commands::registry_snapshot,
            commands::list_computes,
            commands::browser_status,
            light_wallet::light_wallet_info,
            light_wallet::light_wallet_load,
            light_wallet::light_wallet_save,
            light_wallet::light_wallet_wipe,
            light_wallet::light_wallet_reveal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MESH browser");
}
