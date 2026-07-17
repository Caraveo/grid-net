//! Tauri command surface for the MESH browser chrome.

use serde::{Deserialize, Serialize};

use crate::names::{self, NameTable};
use crate::registry::{self, ComputesResponse, RegistrySnapshot};
use crate::resolve::{self, BrowserConfig, ResolveHit};
use crate::url::{self, GridUrl, UrlError};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigateResult {
    pub input: String,
    pub url: Option<GridUrl>,
    pub hit: Option<ResolveHit>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStatus {
    pub version: String,
    pub product: String,
    pub default_scheme: String,
    pub registry_url: String,
    pub names_path: String,
    pub name_count: usize,
    pub gateway: Option<String>,
}

fn browser_config() -> BrowserConfig {
    BrowserConfig {
        gateway_base: std::env::var("GRID_GATEWAY_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    }
}

/// Normalize omnibox input only (no resolve).
#[tauri::command]
pub fn normalize_url(input: String) -> Result<GridUrl, String> {
    url::normalize(&input).map_err(|e: UrlError| e.to_string())
}

/// Normalize → resolve (async: fetches public compute registry).
#[tauri::command]
pub async fn navigate(input: String) -> NavigateResult {
    match url::normalize(&input) {
        Ok(u) => {
            let names = names::load_names();
            // Pull mesh computes for public label resolve (best-effort).
            let mesh = registry::fetch_registry()
                .await
                .map(|s| s.computes)
                .unwrap_or_default();
            let hit = resolve::resolve(&u, &names, &browser_config(), &mesh);
            NavigateResult {
                input,
                url: Some(u),
                hit: Some(hit),
                error: None,
            }
        }
        Err(e) => NavigateResult {
            input,
            url: None,
            hit: Some(ResolveHit::Error {
                message: e.to_string(),
            }),
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn list_names() -> Vec<(String, String)> {
    names::load_names().list()
}

#[tauri::command]
pub fn set_name(label: String, origin: String) -> Result<Vec<(String, String)>, String> {
    let table = names::set_name(&label, &origin)?;
    Ok(table.list())
}

#[tauri::command]
pub async fn registry_snapshot() -> Result<RegistrySnapshot, String> {
    registry::fetch_registry().await
}

/// Public compute capacity (`?available=1` when available_only).
#[tauri::command]
pub async fn list_computes(available_only: bool) -> Result<ComputesResponse, String> {
    registry::fetch_computes(available_only).await
}

#[tauri::command]
pub fn browser_status() -> BrowserStatus {
    let table: NameTable = names::load_names();
    BrowserStatus {
        version: env!("CARGO_PKG_VERSION").into(),
        product: "MESH".into(),
        default_scheme: "grid".into(),
        registry_url: registry::registry_base(),
        names_path: names::names_path().display().to_string(),
        name_count: table.names.len(),
        gateway: browser_config().gateway_base,
    }
}
