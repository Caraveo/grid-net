#!/usr/bin/env bash
# Package Windows + Linux portable MESH shells from vite dist (no native Tauri cross-build).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
OUT="$ROOT/release-portable"
VERSION="${MESH_VERSION:-0.1.0}"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "Missing dist/ — run npm run build first" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/windows/Mesh/app" "$OUT/linux/Mesh/app" "$OUT/staging"

# --- shared frontend assets ---
cp -R "$DIST"/. "$OUT/windows/Mesh/app/"
cp -R "$DIST"/. "$OUT/linux/Mesh/app/"

# --- Windows launcher ---
cat > "$OUT/windows/Mesh/Mesh.bat" << 'BAT'
@echo off
setlocal
set PORT=17420
cd /d "%~dp0app"
echo Mesh · http://127.0.0.1:%PORT%
start "" "http://127.0.0.1:%PORT%/"
where py >nul 2>&1 && (
  py -3 -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)
where python >nul 2>&1 && (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)
echo Install Python 3 or open app\index.html in Microsoft Edge.
pause
BAT

cat > "$OUT/windows/Mesh/README.txt" << 'TXT'
Mesh for Windows 11+
====================
Double-click Mesh.bat
Uses local UI shell. Edge/Chrome recommended.
TXT

# --- Linux launcher ---
cat > "$OUT/linux/Mesh/mesh" << 'SH'
#!/usr/bin/env bash
# Mesh — portable Linux launcher
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${MESH_PORT:-17420}"
cd "$ROOT/app"
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Mesh needs python3 to serve the local UI, or open app/index.html in a browser."
  exit 1
fi
echo "Mesh · http://127.0.0.1:${PORT}"
echo "  Ctrl+C to stop"
$PY -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 0.4
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || true
elif command -v sensible-browser >/dev/null 2>&1; then
  sensible-browser "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || true
fi
wait $PID
SH
chmod +x "$OUT/linux/Mesh/mesh"

cat > "$OUT/linux/Mesh/README.txt" << 'TXT'
Mesh for Linux
==============
1. chmod +x mesh
2. ./mesh
Opens the Mesh UI locally (grid:// browser shell).
TXT

# --- Windows zips ---
(
  cd "$OUT/windows"
  zip -qr "$OUT/MESH-Setup.zip" Mesh
  cp "$OUT/MESH-Setup.zip" "$OUT/MESH-Setup.exe.zip"
  cp "$OUT/MESH-Setup.zip" "$OUT/MESH-windows-x64.zip"
)

cat > "$OUT/MESH-Setup.ps1" << 'PS1'
# Mesh installer (Windows 11+)
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:LOCALAPPDATA "Mesh"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Host "Mesh install dir: $dest"
Write-Host "Unpack the MESH-Setup.zip next to this script, or download from grid-compute.com"
Start-Process "https://grid-compute.com/#mesh-downloads"
PS1

# --- Linux tar.gz ---
(
  cd "$OUT/linux"
  tar -czf "$OUT/MESH-linux-x86_64.tar.gz" Mesh
)

# --- AppImage-style self-extracting script ---
{
  cat << 'HDR'
#!/usr/bin/env bash
set -euo pipefail
TMP=$(mktemp -d)
ARCHIVE=$(awk "/^__MESH_ARCHIVE__/ {print NR + 1; exit 0}" "$0")
tail -n +$ARCHIVE "$0" | tar -xz -C "$TMP"
exec "$TMP/Mesh/mesh" "$@"
exit 0
__MESH_ARCHIVE__
HDR
  cat "$OUT/MESH-linux-x86_64.tar.gz"
} > "$OUT/MESH.AppImage"
chmod +x "$OUT/MESH.AppImage"

# --- Minimal .deb (data.tar.gz + control) ---
DEB_ROOT="$OUT/staging/deb"
rm -rf "$DEB_ROOT"
mkdir -p "$DEB_ROOT/DEBIAN" "$DEB_ROOT/opt/mesh" "$DEB_ROOT/usr/bin"
cp -R "$OUT/linux/Mesh/." "$DEB_ROOT/opt/mesh/"
cat > "$DEB_ROOT/usr/bin/mesh" << 'BIN'
#!/usr/bin/env bash
exec /opt/mesh/mesh "$@"
BIN
chmod +x "$DEB_ROOT/usr/bin/mesh" "$DEB_ROOT/opt/mesh/mesh"
cat > "$DEB_ROOT/DEBIAN/control" << CTRL
Package: mesh
Version: ${VERSION}
Section: web
Priority: optional
Architecture: amd64
Maintainer: GRID <hello@grid-compute.com>
Description: MESH — grid:// browser shell
 Portable Mesh UI for the GRID mesh network.
CTRL

# Build deb with ar if dpkg-deb unavailable
if command -v dpkg-deb >/dev/null 2>&1; then
  dpkg-deb --build "$DEB_ROOT" "$OUT/mesh_amd64.deb" >/dev/null
else
  (
    cd "$DEB_ROOT"
    tar czf "$OUT/staging/data.tar.gz" opt usr
    cd DEBIAN
    tar czf "$OUT/staging/control.tar.gz" control
  )
  echo "2.0" > "$OUT/staging/debian-binary"
  (
    cd "$OUT/staging"
    ar rcs "$OUT/mesh_amd64.deb" debian-binary control.tar.gz data.tar.gz
  )
fi

echo "Portable packages in $OUT:"
ls -lh "$OUT"/*.{zip,gz,AppImage,deb,ps1} 2>/dev/null || ls -lh "$OUT"
