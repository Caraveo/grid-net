//! Local compute name table (`~/.grid/browser/names.toml`).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NameTable {
    #[serde(default)]
    pub names: BTreeMap<String, String>,
}

impl NameTable {
    pub fn get(&self, label: &str) -> Option<&str> {
        self.names.get(label).map(|s| s.as_str())
    }

    pub fn insert(&mut self, label: impl Into<String>, origin: impl Into<String>) {
        self.names.insert(label.into(), origin.into());
    }

    pub fn list(&self) -> Vec<(String, String)> {
        self.names
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NamesFile {
    #[serde(default)]
    names: BTreeMap<String, String>,
}

pub fn browser_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".grid")
        .join("browser")
}

pub fn names_path() -> PathBuf {
    browser_dir().join("names.toml")
}

pub fn ensure_browser_dir() -> std::io::Result<PathBuf> {
    let dir = browser_dir();
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn load_names() -> NameTable {
    let path = names_path();
    load_names_from(&path).unwrap_or_default()
}

pub fn load_names_from(path: &Path) -> Option<NameTable> {
    let raw = fs::read_to_string(path).ok()?;
    let file: NamesFile = toml::from_str(&raw).ok()?;
    Some(NameTable { names: file.names })
}

pub fn save_names(table: &NameTable) -> Result<(), String> {
    ensure_browser_dir().map_err(|e| e.to_string())?;
    let file = NamesFile {
        names: table.names.clone(),
    };
    let raw = toml::to_string_pretty(&file).map_err(|e| e.to_string())?;
    fs::write(names_path(), raw).map_err(|e| e.to_string())
}

pub fn set_name(label: &str, origin: &str) -> Result<NameTable, String> {
    let label = label.trim().to_ascii_lowercase();
    if label.is_empty() {
        return Err("empty label".into());
    }
    let mut table = load_names();
    table.insert(label, origin.trim());
    save_names(&table)?;
    Ok(table)
}
