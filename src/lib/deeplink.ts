/**
 * OS deep-link bridge: grid://… → MESH navigation.
 *
 * Runtime events flow Rust → `mesh://open` (setup get_current, on_open_url,
 * single-instance). The frontend also calls plugin `getCurrent()` **once**
 * for cold-start recovery if the event fired before the webview subscribed.
 *
 * Do not re-subscribe this listener on every React render — that used to
 * re-read getCurrent and open infinite tabs.
 */

export type DeepLinkHandler = (url: string) => void;

/** Normalize OS-provided scheme strings into navigable input. */
export function deepLinkToInput(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  // Some handlers pass grid:host without //
  if (/^grid:[^/]/i.test(s) && !/^grid:\/\//i.test(s)) {
    return `grid://${s.slice("grid:".length)}`;
  }
  return s;
}

export function isGridDeepLink(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return lower.startsWith("grid://") || lower.startsWith("grid:");
}

/**
 * Subscribe to OS open-url events. Returns an unsubscribe fn.
 * Safe no-op outside the Tauri shell.
 *
 * Dedupes identical URLs within a short window so cold-start getCurrent and
 * the Rust event never stack tabs for the same link.
 */
export async function listenDeepLinks(
  onUrl: DeepLinkHandler,
): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  const recent = new Map<string, number>();
  const DEDUPE_MS = 1500;

  const deliver = (urls: string[]) => {
    const now = Date.now();
    for (const u of urls) {
      if (!isGridDeepLink(u)) continue;
      const key = deepLinkToInput(u).toLowerCase();
      const last = recent.get(key) ?? 0;
      if (now - last < DEDUPE_MS) continue;
      recent.set(key, now);
      if (recent.size > 32) {
        const cutoff = now - DEDUPE_MS;
        for (const [k, t] of recent) {
          if (t < cutoff) recent.delete(k);
        }
      }
      onUrl(u);
    }
  };

  // Cold-start only — call once per process subscription, never on re-render.
  try {
    const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
    try {
      const current = await getCurrent();
      if (current?.length) deliver(current);
    } catch {
      /* no cold-start deep link */
    }
  } catch {
    /* plugin unavailable outside Tauri */
  }

  // Ongoing opens from Rust (includes single-instance forwards).
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const un = await listen<{ urls: string[] }>("mesh://open", (ev) => {
      deliver(ev.payload?.urls ?? []);
    });
    cleanups.push(() => {
      void un();
    });
  } catch {
    /* not in Tauri / vite-only preview */
  }

  return () => {
    for (const c of cleanups) {
      try {
        c();
      } catch {
        /* ignore */
      }
    }
  };
}
