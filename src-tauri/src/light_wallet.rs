//! Light wallet keystore paths.
//!
//! - **macOS:** iCloud Drive → `…/Mobile Documents/com~apple~CloudDocs/MESH/`
//!   (syncs with iCloud when signed in; falls back to local Application Support)
//! - **Linux / Windows:** platform data dir and **show the path in UI**

use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const WALLET_FILE: &str = "light-wallet.json";
const MESH_DIR: &str = "MESH";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LightWalletInfo {
    pub platform: String,
    /// `icloud` | `local`
    pub storage_kind: String,
    /// Human label for UI
    pub storage_label: String,
    /// Directory containing the wallet file
    pub directory: String,
    /// Full path to light-wallet.json
    pub file_path: String,
    pub exists: bool,
    /// Whether keys are intended to sync via iCloud
    pub icloud: bool,
}

fn macos_icloud_mesh_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    // Standard user-visible iCloud Drive folder
    let icloud = home
        .join("Library")
        .join("Mobile Documents")
        .join("com~apple~CloudDocs");
    if icloud.is_dir() {
        Some(icloud.join(MESH_DIR))
    } else {
        None
    }
}

#[cfg(not(target_os = "macos"))]
fn local_mesh_dir() -> PathBuf {
    // Prefer XDG / platform data dir
    if let Some(d) = dirs::data_dir() {
        return d.join(MESH_DIR).join("light-wallet");
    }
    if let Some(h) = dirs::home_dir() {
        return h.join(".mesh").join("light-wallet");
    }
    PathBuf::from(".").join("mesh-light-wallet")
}

#[cfg(target_os = "macos")]
#[allow(dead_code)]
fn local_mesh_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join(MESH_DIR)
        .join("light-wallet")
}

/// Resolve store directory + metadata for this OS.
pub fn wallet_info() -> LightWalletInfo {
    #[cfg(target_os = "macos")]
    {
        if let Some(dir) = macos_icloud_mesh_dir() {
            let file = dir.join(WALLET_FILE);
            return LightWalletInfo {
                platform: "macos".into(),
                storage_kind: "icloud".into(),
                storage_label: "iCloud Drive / MESH".into(),
                directory: dir.display().to_string(),
                file_path: file.display().to_string(),
                exists: file.is_file(),
                icloud: true,
            };
        }
        // iCloud Drive folder missing (not signed in) — local Application Support
        let dir = dirs::data_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
            .join(MESH_DIR)
            .join("light-wallet");
        let file = dir.join(WALLET_FILE);
        return LightWalletInfo {
            platform: "macos".into(),
            storage_kind: "local".into(),
            storage_label: "This Mac (iCloud Drive unavailable)".into(),
            directory: dir.display().to_string(),
            file_path: file.display().to_string(),
            exists: file.is_file(),
            icloud: false,
        };
    }

    #[cfg(target_os = "linux")]
    {
        let dir = local_mesh_dir();
        let file = dir.join(WALLET_FILE);
        return LightWalletInfo {
            platform: "linux".into(),
            storage_kind: "local".into(),
            storage_label: "Local directory (Linux)".into(),
            directory: dir.display().to_string(),
            file_path: file.display().to_string(),
            exists: file.is_file(),
            icloud: false,
        };
    }

    #[cfg(target_os = "windows")]
    {
        let dir = local_mesh_dir();
        let file = dir.join(WALLET_FILE);
        return LightWalletInfo {
            platform: "windows".into(),
            storage_kind: "local".into(),
            storage_label: "Local directory (Windows)".into(),
            directory: dir.display().to_string(),
            file_path: file.display().to_string(),
            exists: file.is_file(),
            icloud: false,
        };
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let dir = local_mesh_dir();
        let file = dir.join(WALLET_FILE);
        LightWalletInfo {
            platform: std::env::consts::OS.into(),
            storage_kind: "local".into(),
            storage_label: "Local directory".into(),
            directory: dir.display().to_string(),
            file_path: file.display().to_string(),
            exists: file.is_file(),
            icloud: false,
        }
    }
}

fn ensure_parent(file: &PathBuf) -> Result<(), String> {
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create dir: {e}"))?;
        // Drop a short README so the folder is self-explanatory when opened
        let readme = parent.join("README.txt");
        if !readme.exists() {
            let body = "MESH light wallet\n\
Keys and grid0 address for the disposable browser wallet.\n\
On Mac: this folder is under iCloud Drive when available.\n\
On Linux/Windows: this is the local wallet directory — do not share light-wallet.json.\n\
Lose this file + passkey = lose light-wallet GRID.\n";
            let _ = fs::write(readme, body);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn light_wallet_info() -> LightWalletInfo {
    wallet_info()
}

#[tauri::command]
pub fn light_wallet_load() -> Result<Option<String>, String> {
    let info = wallet_info();
    let path = PathBuf::from(&info.file_path);
    if !path.is_file() {
        // migrate from browser localStorage is frontend-only; also check legacy path nothing
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read wallet: {e}"))?;
    Ok(Some(raw))
}

#[tauri::command]
pub fn light_wallet_save(json: String) -> Result<LightWalletInfo, String> {
    // validate JSON object
    let _: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| format!("invalid wallet json: {e}"))?;
    let info = wallet_info();
    let path = PathBuf::from(&info.file_path);
    ensure_parent(&path)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json.as_bytes()).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(wallet_info())
}

#[tauri::command]
pub fn light_wallet_wipe() -> Result<LightWalletInfo, String> {
    let info = wallet_info();
    let path = PathBuf::from(&info.file_path);
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("remove: {e}"))?;
    }
    Ok(wallet_info())
}

/// Open the wallet directory in the OS file manager (Finder / Explorer / etc.).
#[tauri::command]
pub fn light_wallet_reveal(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    let info = wallet_info();
    let dir = PathBuf::from(&info.directory);
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| format!("open folder: {e}"))?;
    Ok(info.directory)
}
