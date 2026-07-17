//! `grid://` URL parse + omnibox normalization.
//!
//! Core product rule: bare labels are first-class.
//!
//! ```text
//! x  ≡  x.grid  ≡  grid://x  ≡  grid://x.grid  ≡  grid://x.grid/
//! →  grid://x.grid/
//! ```

use serde::{Deserialize, Serialize};
use thiserror::Error;

const GRID_TLD: &str = "grid";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scheme {
    Grid,
    Http,
    Https,
}

impl Scheme {
    pub fn as_str(self) -> &'static str {
        match self {
            Scheme::Grid => "grid",
            Scheme::Http => "http",
            Scheme::Https => "https",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridUrl {
    pub scheme: Scheme,
    /// Compute / site id without TLD (`"x"`).
    pub label: String,
    /// Canonical host for grid scheme (`"x.grid"`); host for http(s).
    pub host: String,
    pub path: String,
    pub query: Option<String>,
    pub fragment: Option<String>,
    /// Full display form after normalization.
    pub display: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UrlError {
    #[error("empty address")]
    Empty,
    #[error("unsupported scheme: {0}")]
    UnsupportedScheme(String),
    #[error("invalid GRID name: {0}")]
    InvalidLabel(String),
    #[error("missing host")]
    MissingHost,
    #[error("invalid address: {0}")]
    Invalid(String),
}

/// Normalize omnibox / navigation input into a canonical [`GridUrl`].
pub fn normalize(input: &str) -> Result<GridUrl, UrlError> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err(UrlError::Empty);
    }

    let lower = raw.to_ascii_lowercase();

    // Legacy web — no .grid injection.
    if lower.starts_with("https://") || lower == "https:" {
        return normalize_legacy(raw, Scheme::Https);
    }
    if lower.starts_with("http://") || lower == "http:" {
        return normalize_legacy(raw, Scheme::Http);
    }

    // Reject other schemes early (except bare grid:// handled below).
    if let Some(idx) = raw.find("://") {
        let scheme = &raw[..idx];
        if !scheme.eq_ignore_ascii_case("grid") {
            return Err(UrlError::UnsupportedScheme(scheme.to_string()));
        }
        return normalize_grid_with_scheme(&raw[idx + 3..]);
    }

    // grid:foo  (rare)
    if let Some(rest) = lower.strip_prefix("grid:") {
        let rest_orig = &raw["grid:".len()..];
        if rest.starts_with("//") {
            return normalize_grid_with_scheme(&rest_orig[2..]);
        }
        return normalize_grid_with_scheme(rest_orig);
    }

    // Bare GRID navigation: label | label.grid | label/path | label.grid/path
    normalize_grid_with_scheme(raw)
}

fn normalize_legacy(raw: &str, scheme: Scheme) -> Result<GridUrl, UrlError> {
    let without_scheme = raw
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or("");

    if without_scheme.is_empty() {
        return Err(UrlError::MissingHost);
    }

    let (before_frag, fragment) = split_once_char(without_scheme, '#');
    let (before_query, query) = split_once_char(before_frag, '?');

    let (host_port, path_raw) = if let Some(slash) = before_query.find('/') {
        (&before_query[..slash], &before_query[slash..])
    } else {
        (before_query, "/")
    };

    if host_port.is_empty() {
        return Err(UrlError::MissingHost);
    }

    let host = host_port.to_string();
    let path = normalize_path(path_raw);
    let query = empty_to_none(query);
    let fragment = empty_to_none(fragment);

    let display = format_display(scheme, &host, &path, query.as_deref(), fragment.as_deref());

    Ok(GridUrl {
        scheme,
        label: String::new(),
        host,
        path,
        query,
        fragment,
        display,
    })
}

fn normalize_grid_with_scheme(rest: &str) -> Result<GridUrl, UrlError> {
    let rest = rest.trim();
    if rest.is_empty() {
        return Err(UrlError::MissingHost);
    }

    // Reject multi-dot public DNS masquerading as grid names when no scheme was used.
    // Allowed forms after strip: label, label.grid, optionally with path/query/fragment.
    let (before_frag, fragment) = split_once_char(rest, '#');
    let (before_query, query) = split_once_char(before_frag, '?');

    let (host_part, path_raw) = if let Some(slash) = before_query.find('/') {
        (&before_query[..slash], &before_query[slash..])
    } else {
        (before_query, "/")
    };

    let host_part = host_part.trim().trim_end_matches('.');
    if host_part.is_empty() {
        return Err(UrlError::MissingHost);
    }

    // Disallow userinfo / ports on grid names for MVP.
    if host_part.contains('@') || host_part.contains(':') {
        return Err(UrlError::Invalid(host_part.to_string()));
    }

    let label = extract_label(host_part)?;
    let host = format!("{label}.{GRID_TLD}");
    let path = normalize_path(path_raw);
    let query = empty_to_none(query);
    let fragment = empty_to_none(fragment);
    let display = format_display(
        Scheme::Grid,
        &host,
        &path,
        query.as_deref(),
        fragment.as_deref(),
    );

    Ok(GridUrl {
        scheme: Scheme::Grid,
        label,
        host,
        path,
        query,
        fragment,
        display,
    })
}

/// Strip optional trailing `.grid` TLD; validate label.
fn extract_label(host_part: &str) -> Result<String, UrlError> {
    let lower = host_part.to_ascii_lowercase();

    let label = if let Some(stripped) = lower.strip_suffix(&format!(".{GRID_TLD}")) {
        // Only the GRID TLD suffix — reject multi-level like foo.bar.grid for MVP? Allow foo-bar.grid.
        // Reject if stripped still contains a dot (e.g. foo.bar.grid → multi-dot).
        if stripped.contains('.') {
            return Err(UrlError::InvalidLabel(host_part.to_string()));
        }
        stripped
    } else if lower.contains('.') {
        // e.g. foo.bar.com without .grid — not a GRID bare name
        return Err(UrlError::InvalidLabel(host_part.to_string()));
    } else {
        lower.as_str()
    };

    if !is_valid_label(label) {
        return Err(UrlError::InvalidLabel(host_part.to_string()));
    }

    Ok(label.to_string())
}

fn is_valid_label(label: &str) -> bool {
    let b = label.as_bytes();
    if b.is_empty() || b.len() > 63 {
        return false;
    }
    // [a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?
    if !b[0].is_ascii_alphanumeric() {
        return false;
    }
    if b.len() == 1 {
        return true;
    }
    if !b[b.len() - 1].is_ascii_alphanumeric() {
        return false;
    }
    b.iter()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
}

fn normalize_path(path: &str) -> String {
    if path.is_empty() {
        return "/".into();
    }
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn format_display(
    scheme: Scheme,
    host: &str,
    path: &str,
    query: Option<&str>,
    fragment: Option<&str>,
) -> String {
    let mut s = format!("{}://{}{}", scheme.as_str(), host, path);
    if let Some(q) = query {
        s.push('?');
        s.push_str(q);
    }
    if let Some(f) = fragment {
        s.push('#');
        s.push_str(f);
    }
    s
}

fn split_once_char(s: &str, c: char) -> (&str, Option<&str>) {
    match s.split_once(c) {
        Some((a, b)) => (a, Some(b)),
        None => (s, None),
    }
}

fn empty_to_none(s: Option<&str>) -> Option<String> {
    s.map(str::trim)
        .filter(|x| !x.is_empty())
        .map(|x| x.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_grid(input: &str, label: &str, path: &str) {
        let u = normalize(input).expect(input);
        assert_eq!(u.scheme, Scheme::Grid, "input={input}");
        assert_eq!(u.label, label, "input={input}");
        assert_eq!(u.host, format!("{label}.grid"), "input={input}");
        assert_eq!(u.path, path, "input={input}");
        assert_eq!(
            u.display,
            format!("grid://{label}.grid{path}"),
            "input={input}"
        );
    }

    #[test]
    fn bare_label_is_grid() {
        assert_grid("x", "x", "/");
        assert_grid("X", "x", "/");
        assert_grid("garage", "garage", "/");
        assert_grid("home", "home", "/");
    }

    #[test]
    fn equivalence_table() {
        let inputs = ["x", "x.grid", "grid://x", "grid://x.grid", "grid://x.grid/"];
        let expected = normalize("x").unwrap();
        for i in inputs {
            let u = normalize(i).unwrap();
            assert_eq!(u, expected, "input={i}");
            assert_eq!(u.display, "grid://x.grid/");
        }
    }

    #[test]
    fn path_and_query() {
        let u = normalize("x.grid/about?q=1#top").unwrap();
        assert_eq!(u.label, "x");
        assert_eq!(u.path, "/about");
        assert_eq!(u.query.as_deref(), Some("q=1"));
        assert_eq!(u.fragment.as_deref(), Some("top"));
        assert_eq!(u.display, "grid://x.grid/about?q=1#top");
    }

    #[test]
    fn bare_with_path() {
        assert_grid("home/help", "home", "/help");
        assert_grid("registry/", "registry", "/");
    }

    #[test]
    fn https_passthrough() {
        let u = normalize("https://grid-compute.com/api").unwrap();
        assert_eq!(u.scheme, Scheme::Https);
        assert_eq!(u.host, "grid-compute.com");
        assert_eq!(u.path, "/api");
        assert_eq!(u.label, "");
        assert_eq!(u.display, "https://grid-compute.com/api");
    }

    #[test]
    fn rejects_multi_dot_without_scheme() {
        assert!(matches!(
            normalize("foo.bar.com"),
            Err(UrlError::InvalidLabel(_))
        ));
        assert!(matches!(
            normalize("foo.bar.grid"),
            Err(UrlError::InvalidLabel(_))
        ));
    }

    #[test]
    fn rejects_unknown_scheme() {
        assert!(matches!(
            normalize("ftp://x"),
            Err(UrlError::UnsupportedScheme(_))
        ));
    }

    #[test]
    fn rejects_invalid_labels() {
        assert!(normalize("-x").is_err());
        assert!(normalize("x-").is_err());
        assert!(normalize("").is_err());
        assert!(normalize("   ").is_err());
    }

    #[test]
    fn hyphen_labels_ok() {
        assert_grid("my-node", "my-node", "/");
        assert_grid("my-node.grid", "my-node", "/");
    }
}
