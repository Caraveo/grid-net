# MESH

Cross-platform browser for the **GRID** mesh. Product name **MESH**. Default scheme is **`grid://`**.

```
x  →  grid://x.grid/
```

Type a compute name. No extension required. The address bar canonicalizes to `grid://{name}.grid`.

<p align="center">
  <img src="./public/logo.svg" alt="GRID" width="64" height="64" />
</p>

## Quick start

```bash
npm install
npm run tauri:dev
```

Requires [Rust](https://rustup.rs) and platform WebView deps (macOS ships with WKWebView).

Build release:

```bash
npm run tauri:build
```

## OS registration: `grid://` links open MESH

MESH claims the **`grid://`** URL scheme so system links open this app.

| OS | How it registers | Test |
|----|------------------|------|
| **macOS** | Bundled `CFBundleURLTypes` via deep-link config (must **install** `.app`, ideally under `/Applications`) | `open 'grid://home.grid'` |
| **Windows** | Runtime registry + installer (`Software\Classes\grid`) | `start grid://home.grid` |
| **Linux** | Runtime `.desktop` handler (`x-scheme-handler/grid`) | `xdg-open 'grid://home.grid'` |

Config lives in `src-tauri/tauri.conf.json` → `plugins.deep-link`.

**macOS note:** Dev mode (`tauri dev`) does **not** fully register the scheme. Build and install:

```bash
npm run tauri:build
# then open the generated MESH.app (or copy to /Applications)
open 'grid://registry.grid'
```

Clicking `grid://…` while MESH is already running focuses the window and opens a new tab.

## Omnibox rules

| You type | Opens |
|----------|--------|
| `x` | `grid://x.grid/` |
| `x.grid` | `grid://x.grid/` |
| `grid://x` | `grid://x.grid/` |
| `home` | `grid://home.grid/` (start page) |
| `https://…` | legacy web (secondary) |

Same mental model as the CLI: `grid launch x` ↔ browser `x`.

## Built-in sites

| Name | Purpose |
|------|---------|
| `home.grid` | Start page |
| `grid.grid` | Public site → [grid-compute.com](https://grid-compute.com/) (“Soon…”) |
| `registry.grid` | Public **computes** + mesh peers (grid-compute.com) |
| `status.grid` | Browser + mesh status |
| `help.grid` | How `grid://` works |
| `settings.grid` | Local name map |

## Public compute resolve

Resolution order for a bare label `garage`:

1. Built-in pages  
2. Local `~/.grid/browser/names.toml`  
3. **Public compute registry** (`GET /api/registry` · `/api/registry/computes`)  
4. Optional gateway (`GRID_GATEWAY_URL`)  
5. Not found  

Hosts announce capacity with the CLI:

```bash
grid launch garage --public
grid host
# or: grid compute announce
```

Browser: type `garage` → mesh page with availability / free slots.

## Local compute names

```toml
# ~/.grid/browser/names.toml
[names]
x = "http://127.0.0.1:8080"
```

Optional gateway: set env `GRID_GATEWAY_URL` (e.g. `https://gateway.example`).

Registry URL override: `GRID_REGISTRY_URL` / `GRID_SITE_URL` (default `https://grid-compute.com`).

## Stack

- **Tauri 2** + Rust (`src-tauri`) — URL normalize, resolve, registry client
- **React + Vite + Tailwind 4** — chrome UI
- Independent of the `grid` CLI binary (observes the network; does not modify it)

## Tests

```bash
cd src-tauri && cargo test
```

Locks the bare-label equivalence:

```
x ≡ x.grid ≡ grid://x ≡ grid://x.grid ≡ grid://x.grid/
```

## Related

- [grid](https://github.com/Caraveo/grid) — node CLI (host / mine / coord)
- [grid-compute.com](https://grid-compute.com) — public mesh registry

## License

MIT
