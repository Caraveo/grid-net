mod commands;
mod names;
mod registry;
mod resolve;
mod url;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::normalize_url,
            commands::navigate,
            commands::list_names,
            commands::set_name,
            commands::registry_snapshot,
            commands::list_computes,
            commands::browser_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MESH browser");
}
