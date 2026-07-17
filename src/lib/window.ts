/** Elements that must NOT start a window drag (user needs to interact with them). */
const NO_DRAG_SELECTOR =
  "input, textarea, select, option, button, a, [contenteditable='true'], [data-no-drag]";

export function isNoDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(NO_DRAG_SELECTOR));
}

/**
 * Start native window drag (Tauri).
 * Must be called synchronously from a user gesture (mousedown/pointerdown).
 * Requires `core:window:allow-start-dragging` in capabilities.
 */
export function startWindowDrag(): void {
  // Fire-and-forget; do not await — macOS wants this in the same tick as the gesture.
  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
    .catch((err) => {
      console.warn("[MESH] startDragging failed:", err);
    });
}

/** mousedown/pointerdown handler for chrome drag regions. */
export function onChromePointerDown(e: {
  button: number;
  target: EventTarget | null;
  preventDefault?: () => void;
}): void {
  if (e.button !== 0) return;
  if (isNoDragTarget(e.target)) return;
  startWindowDrag();
}
