import type { BrowserStatus, ResolveHit } from "../lib/types";
import { onChromePointerDown } from "../lib/window";

interface Props {
  status: BrowserStatus | null;
  hit: ResolveHit | null;
  peerCount?: number | null;
  computeCount?: number | null;
  phase?: string | null;
}

function resolverLabel(hit: ResolveHit | null): string {
  if (!hit) return "idle";
  switch (hit.kind) {
    case "builtin":
      return `builtin · ${hit.page}`;
    case "local":
      return `local · ${hit.label}`;
    case "mesh":
      return `mesh · ${hit.name} · ${hit.status}`;
    case "gateway":
      return `gateway · ${hit.label}`;
    case "legacy":
      return "legacy web";
    case "not_found":
      return `not found · ${hit.label}`;
    case "error":
      return "error";
  }
}

export function StatusBar({
  status,
  hit,
  peerCount,
  computeCount,
  phase,
}: Props) {
  return (
    <footer
      data-tauri-drag-region
      className="titlebar-drag flex h-[var(--status-h)] shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-3"
      onPointerDown={onChromePointerDown}
    >
      <div className="mono flex min-w-0 items-center gap-3 text-[0.6rem] tracking-wider text-dim uppercase">
        <span className="truncate">{resolverLabel(hit)}</span>

      </div>
      <div className="mono flex shrink-0 items-center gap-3 text-[0.6rem] tracking-wider text-dim uppercase">
        <span>phase {phase ?? "1"}</span>
        {peerCount != null && <span>{peerCount} peers</span>}
        {computeCount != null && <span>{computeCount} computes</span>}
        <span className="text-muted">grid://</span>
        {status && <span>v{status.version}</span>}
      </div>
    </footer>
  );
}
