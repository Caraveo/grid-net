import type { ResolveHit } from "../lib/types";
import { ErrorPage } from "../pages/ErrorPage";
import { Help } from "../pages/Help";
import { Home } from "../pages/Home";
import { Registry } from "../pages/Registry";
import { Settings } from "../pages/Settings";
import { Site } from "../pages/Site";
import { Status } from "../pages/Status";

interface Props {
  hit: ResolveHit | null;
  peerCount?: number | null;
  computeCount?: number | null;
  phase?: string | null;
  onGo: (input: string) => void;
}

export function Viewport({
  hit,
  peerCount,
  computeCount,
  phase,
  onGo,
}: Props) {
  if (!hit) {
    return <Home onGo={onGo} />;
  }

  switch (hit.kind) {
    case "builtin":
      switch (hit.page) {
        case "home":
          return <Home onGo={onGo} />;
        case "site":
          return <Site />;
        case "registry":
          return <Registry onGo={onGo} />;
        case "status":
          return (
            <Status
              peerCount={peerCount}
              computeCount={computeCount}
              phase={phase}
            />
          );
        case "help":
          return <Help onGo={onGo} />;
        case "settings":
          return <Settings />;
        case "error":
          return <ErrorPage message="Something went wrong." onGo={onGo} />;
      }
      break;
    case "local":
      return (
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
            grid://{hit.label}.grid
          </p>
          <h1 className="mt-4 text-2xl font-thin">{hit.label}</h1>
          <p className="mt-3 max-w-md text-foreground/55">
            This realm is ready on the mesh. Content will open here in a future
            release.
          </p>
          <button
            type="button"
            className="mt-8 rounded-full border border-border px-5 py-2 text-sm hover:bg-surface-2"
            onClick={() => onGo("home")}
          >
            Home
          </button>
        </div>
      );
    case "mesh":
      return <MeshCompute hit={hit} onGo={onGo} />;
    case "gateway":
      return (
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
            grid://{hit.label}.grid
          </p>
          <h1 className="mt-4 text-2xl font-thin">{hit.label}</h1>
          <p className="mt-3 max-w-md text-foreground/55">
            Reaching this realm through the mesh.
          </p>
        </div>
      );
    case "legacy":
      return (
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mono text-[0.65rem] tracking-[0.25em] text-chip-legacy uppercase">
            Outside the mesh
          </p>
          <h1 className="mt-4 text-2xl font-thin">Not a realm</h1>
          <p className="mt-3 max-w-md text-foreground/55">
            MESH is for grid:// realms. Open web pages in your system browser if
            needed.
          </p>
          <button
            type="button"
            className="mt-8 rounded-full border border-border px-5 py-2 text-sm hover:bg-surface-2"
            onClick={() => onGo("home")}
          >
            Back to mesh
          </button>
        </div>
      );
    case "not_found":
      return (
        <ErrorPage
          title="Compute not found"
          message={hit.message}
          label={hit.label}
          onGo={onGo}
        />
      );
    case "error":
      return (
        <ErrorPage title="Invalid address" message={hit.message} onGo={onGo} />
      );
  }

  return <Home onGo={onGo} />;
}

function MeshCompute({
  hit,
  onGo,
}: {
  hit: Extract<ResolveHit, { kind: "mesh" }>;
  onGo: (input: string) => void;
}) {
  const available = hit.status === "available";
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://{hit.label}.grid · public mesh
      </p>
      <h1 className="mt-4 text-3xl font-thin tracking-wide">{hit.name}</h1>
      <p className="mt-3 max-w-md text-foreground/55">
        Found on the public mesh. Capacity only — no host details.
      </p>

      <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3 text-left">
        <Meta label="Status" value={hit.status} accent={available} />
        <Meta
          label="Slots"
          value={`${hit.freeSlots}/${hit.replicas}`}
          accent={hit.freeSlots > 0}
        />
        <Meta label="Visibility" value={hit.visibility} />
        <Meta label="Class" value={hit.class} />
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="rounded-full border border-border px-5 py-2 text-sm hover:bg-surface-2"
          onClick={() => onGo("registry")}
        >
          Browse registry
        </button>
        <button
          type="button"
          className="rounded-full border border-border px-5 py-2 text-sm hover:bg-surface-2"
          onClick={() => onGo("home")}
        >
          Home
        </button>
      </div>

      {!available && (
        <p className="mono mt-8 max-w-sm text-[0.7rem] text-dim">
          This compute is registered but not currently available. Capacity
          refreshes while the host is running.
        </p>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="mono text-[0.6rem] tracking-wider text-dim uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-sm ${mono ? "mono" : ""} ${
          accent ? "text-status-ok" : "text-foreground/80"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
