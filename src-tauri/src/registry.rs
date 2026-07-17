//! Public mesh + compute registry client — https://grid-compute.com

use serde::{Deserialize, Serialize};

pub const DEFAULT_REGISTRY_URL: &str = "https://grid-compute.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryNode {
    pub id: String,
    pub label: String,
    pub class: String,
    pub region: String,
    pub status: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub lat: Option<f64>,
    #[serde(default)]
    pub lng: Option<f64>,
}

/// Public compute capacity entry (no IPs / endpoints).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCompute {
    pub id: String,
    pub name: String,
    pub node_id: String,
    #[serde(default)]
    pub label: String,
    pub image: String,
    pub visibility: String,
    pub class: String,
    #[serde(default)]
    pub backend: String,
    #[serde(default)]
    pub replicas: u32,
    #[serde(default)]
    pub free_slots: u32,
    pub status: String,
    #[serde(default)]
    pub last_seen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySnapshot {
    #[serde(default)]
    pub registry: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub peers: Vec<RegistryNode>,
    #[serde(default)]
    pub nodes: Vec<RegistryNode>,
    #[serde(default)]
    pub stats: Option<serde_json::Value>,
    #[serde(default)]
    pub computes: Vec<PublicCompute>,
    #[serde(default)]
    pub compute_stats: Option<serde_json::Value>,
    #[serde(default)]
    pub compute_available_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputesResponse {
    #[serde(default)]
    pub registry: Option<String>,
    #[serde(default)]
    pub computes: Vec<PublicCompute>,
    #[serde(default)]
    pub stats: Option<serde_json::Value>,
    #[serde(default)]
    pub available_ms: Option<u64>,
}

pub fn registry_base() -> String {
    std::env::var("GRID_REGISTRY_URL")
        .or_else(|_| std::env::var("GRID_SITE_URL"))
        .ok()
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_REGISTRY_URL.to_string())
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())
}

pub async fn fetch_registry() -> Result<RegistrySnapshot, String> {
    let base = registry_base();
    let url = format!("{base}/api/registry");
    let client = http_client()?;
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("registry HTTP {}", resp.status()));
    }
    let mut snap = resp
        .json::<RegistrySnapshot>()
        .await
        .map_err(|e| e.to_string())?;

    // Older deploys may omit computes on /api/registry — fill from dedicated endpoint.
    if snap.computes.is_empty() {
        if let Ok(comp) = fetch_computes(false).await {
            snap.computes = comp.computes;
            snap.compute_stats = comp.stats;
            snap.compute_available_ms = comp.available_ms;
        }
    }
    Ok(snap)
}

pub async fn fetch_computes(available_only: bool) -> Result<ComputesResponse, String> {
    let base = registry_base();
    let url = if available_only {
        format!("{base}/api/registry/computes?available=1")
    } else {
        format!("{base}/api/registry/computes")
    };
    let client = http_client()?;
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("computes HTTP {}", resp.status()));
    }
    resp.json::<ComputesResponse>()
        .await
        .map_err(|e| e.to_string())
}

/// Find best public compute for a bare grid label (name match).
/// Prefers available + public; falls back to any name match.
pub fn find_compute_for_label<'a>(
    computes: &'a [PublicCompute],
    label: &str,
) -> Option<&'a PublicCompute> {
    let label = label.trim().to_ascii_lowercase();
    if label.is_empty() {
        return None;
    }

    let matches: Vec<&PublicCompute> = computes
        .iter()
        .filter(|c| c.name.eq_ignore_ascii_case(&label))
        .collect();
    if matches.is_empty() {
        return None;
    }

    // Prefer available public
    if let Some(c) = matches
        .iter()
        .find(|c| c.status == "available" && c.visibility == "public")
    {
        return Some(*c);
    }
    // Any available
    if let Some(c) = matches.iter().find(|c| c.status == "available") {
        return Some(*c);
    }
    // Public but busy
    if let Some(c) = matches.iter().find(|c| c.visibility == "public") {
        return Some(*c);
    }
    matches.first().copied()
}
