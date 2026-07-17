//! Name → content resolution chain for `grid://` labels.

use serde::{Deserialize, Serialize};

use crate::names::NameTable;
use crate::registry::PublicCompute;
use crate::url::{GridUrl, Scheme};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BuiltinPage {
    Home,
    Registry,
    Status,
    Help,
    Settings,
    Error,
}

impl BuiltinPage {
    pub fn from_label(label: &str) -> Option<Self> {
        match label {
            "home" | "start" | "newtab" => Some(Self::Home),
            "registry" | "mesh" | "peers" | "computes" => Some(Self::Registry),
            "status" | "about" => Some(Self::Status),
            "help" | "docs" => Some(Self::Help),
            "settings" | "config" | "prefs" => Some(Self::Settings),
            "error" => Some(Self::Error),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ResolveHit {
    Builtin {
        page: BuiltinPage,
        label: String,
    },
    /// Local names.toml mapping
    Local {
        label: String,
        origin: String,
    },
    /// Public compute from grid-compute.com registry
    Mesh {
        label: String,
        compute_id: String,
        name: String,
        node_id: String,
        image: String,
        visibility: String,
        status: String,
        free_slots: u32,
        replicas: u32,
        class: String,
        backend: String,
    },
    Gateway {
        label: String,
        url: String,
    },
    Legacy {
        url: String,
    },
    NotFound {
        label: String,
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Default)]
pub struct BrowserConfig {
    /// Optional HTTP gateway base, e.g. `https://gateway.example`
    pub gateway_base: Option<String>,
}

/// Resolve a normalized URL through the chain:
/// built-in → local names → public mesh computes → gateway → not found.
pub fn resolve(
    url: &GridUrl,
    names: &NameTable,
    cfg: &BrowserConfig,
    mesh_computes: &[PublicCompute],
) -> ResolveHit {
    match url.scheme {
        Scheme::Http | Scheme::Https => ResolveHit::Legacy {
            url: url.display.clone(),
        },
        Scheme::Grid => resolve_grid(&url.label, names, cfg, mesh_computes),
    }
}

fn resolve_grid(
    label: &str,
    names: &NameTable,
    cfg: &BrowserConfig,
    mesh_computes: &[PublicCompute],
) -> ResolveHit {
    if let Some(page) = BuiltinPage::from_label(label) {
        return ResolveHit::Builtin {
            page,
            label: label.to_string(),
        };
    }

    if let Some(origin) = names.get(label) {
        return ResolveHit::Local {
            label: label.to_string(),
            origin: origin.to_string(),
        };
    }

    if let Some(c) = crate::registry::find_compute_for_label(mesh_computes, label) {
        return ResolveHit::Mesh {
            label: label.to_string(),
            compute_id: c.id.clone(),
            name: c.name.clone(),
            node_id: c.node_id.clone(),
            image: c.image.clone(),
            visibility: c.visibility.clone(),
            status: c.status.clone(),
            free_slots: c.free_slots,
            replicas: c.replicas,
            class: c.class.clone(),
            backend: c.backend.clone(),
        };
    }

    if let Some(base) = cfg.gateway_base.as_ref() {
        let base = base.trim_end_matches('/');
        return ResolveHit::Gateway {
            label: label.to_string(),
            url: format!("{base}/{label}/"),
        };
    }

    ResolveHit::NotFound {
        label: label.to_string(),
        message: format!(
            "Compute «{label}» not found on the mesh — try registry.grid or grid launch {label}"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::url::normalize;

    #[test]
    fn builtin_home() {
        let u = normalize("home").unwrap();
        let hit = resolve(
            &u,
            &NameTable::default(),
            &BrowserConfig::default(),
            &[],
        );
        assert!(matches!(
            hit,
            ResolveHit::Builtin {
                page: BuiltinPage::Home,
                ..
            }
        ));
    }

    #[test]
    fn bare_x_not_found_without_names() {
        let u = normalize("x").unwrap();
        let hit = resolve(
            &u,
            &NameTable::default(),
            &BrowserConfig::default(),
            &[],
        );
        match hit {
            ResolveHit::NotFound { label, .. } => assert_eq!(label, "x"),
            other => panic!("expected NotFound, got {other:?}"),
        }
    }

    #[test]
    fn local_name() {
        let mut names = NameTable::default();
        names.insert("x", "http://127.0.0.1:8080");
        let u = normalize("x").unwrap();
        let hit = resolve(&u, &names, &BrowserConfig::default(), &[]);
        match hit {
            ResolveHit::Local { label, origin } => {
                assert_eq!(label, "x");
                assert_eq!(origin, "http://127.0.0.1:8080");
            }
            other => panic!("expected Local, got {other:?}"),
        }
    }

    #[test]
    fn mesh_compute() {
        let computes = vec![PublicCompute {
            id: "node_abc:garage".into(),
            name: "garage".into(),
            node_id: "node_abc".into(),
            label: "Mac".into(),
            image: "alpine:3.20".into(),
            visibility: "public".into(),
            class: "S".into(),
            backend: "docker".into(),
            replicas: 2,
            free_slots: 2,
            status: "available".into(),
            last_seen: None,
        }];
        let u = normalize("garage").unwrap();
        let hit = resolve(
            &u,
            &NameTable::default(),
            &BrowserConfig::default(),
            &computes,
        );
        match hit {
            ResolveHit::Mesh {
                name,
                free_slots,
                status,
                ..
            } => {
                assert_eq!(name, "garage");
                assert_eq!(free_slots, 2);
                assert_eq!(status, "available");
            }
            other => panic!("expected Mesh, got {other:?}"),
        }
    }
}
