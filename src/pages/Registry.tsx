import { useEffect, useState } from "react";
import { registrySnapshot } from "../lib/api";
import type { PublicCompute, RegistrySnapshot } from "../lib/types";

interface Props {
  onGo?: (input: string) => void;
}

type Entry = {
  name: string;
  label: string;
  class: string;
  region: string;
  kinds: string[];
  nodeOnline: boolean;
  computeOnline: boolean;
  freeSlots: number;
  replicas: number;
  computeStatus: string | null;
  image: string | null;
  registeredAt: string;
};

export function Registry({ onGo }: Props) {
  const [data, setData] = useState<RegistrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyOnline, setOnlyOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const snap = await registrySnapshot();
      if (cancelled) return;
      if (!snap) {
        setError("Could not reach public registry");
        setData(null);
      } else {
        setData(snap);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries: Entry[] = (data as RegistrySnapshot & { entries?: Entry[] })
    ?.entries
    ? ((data as RegistrySnapshot & { entries: Entry[] }).entries ?? [])
    : // fallback: build from registered computes only
      (data?.computes ?? []).map((c: PublicCompute) => ({
        name: c.name,
        label: c.label ?? c.name,
        class: c.class,
        region: "—",
        kinds: ["compute"],
        nodeOnline: false,
        computeOnline: c.status === "available" || c.status === "busy",
        freeSlots: c.freeSlots ?? 0,
        replicas: c.replicas ?? 1,
        computeStatus: c.status,
        image: c.image,
        registeredAt: c.lastSeen ?? "",
      }));

  const visible = onlyOnline
    ? entries.filter((e) => e.nodeOnline || e.computeOnline)
    : entries;

  const stats = data?.stats as
    | {
        registered?: number;
        registeredNodes?: number;
        registeredComputes?: number;
      }
    | undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://registry.grid
      </p>
      <h1 className="mt-3 text-3xl font-thin tracking-wide">Public registry</h1>
      <p className="mt-3 text-muted">
        Only names that completed{" "}
        <button
          type="button"
          className="text-foreground/80 underline-offset-2 hover:underline"
          onClick={() =>
            window.open("https://grid-compute.com/registry", "_blank")
          }
        >
          registration
        </button>{" "}
        (Cash App → $Caraveo → approve) as a{" "}
        <strong className="text-foreground/70">node</strong> and/or{" "}
        <strong className="text-foreground/70">compute</strong> appear here. Live
        pings alone are not enough.
      </p>

      {loading && (
        <p className="mono mt-10 text-sm tracking-widest text-dim uppercase">
          Loading…
        </p>
      )}
      {error && <p className="mt-10 text-red-400">{error}</p>}

      {!loading && data && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="mono text-[0.65rem] tracking-wider text-muted uppercase">
              {stats?.registered ?? entries.length} registered ·{" "}
              {stats?.registeredNodes ?? "—"} nodes ·{" "}
              {stats?.registeredComputes ?? "—"} computes
            </p>
            <label className="mono flex items-center gap-2 text-[0.65rem] tracking-wider text-muted uppercase">
              <input
                type="checkbox"
                checked={onlyOnline}
                onChange={(e) => setOnlyOnline(e.target.checked)}
                className="accent-white"
              />
              Online only
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="mt-10 rounded-xl border border-border bg-surface px-5 py-8 text-center">
              <p className="text-muted">
                No registered entities yet.
              </p>
              <p className="mono mt-3 text-xs text-dim">
                Register at grid-compute.com/registry → pay $Caraveo → admin
                approve
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="mono border-b border-border bg-surface text-[0.6rem] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Name</th>
                    <th className="px-4 py-2.5 font-normal">Kinds</th>
                    <th className="px-4 py-2.5 font-normal">Node</th>
                    <th className="px-4 py-2.5 font-normal">Compute</th>
                    <th className="px-4 py-2.5 font-normal">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr
                      key={e.name}
                      className="border-b border-border last:border-0 hover:bg-surface"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="mono text-foreground/90 underline-offset-2 hover:underline"
                          onClick={() => onGo?.(e.name)}
                        >
                          {e.name}
                        </button>
                        <p className="mt-0.5 text-xs text-dim">{e.label}</p>
                      </td>
                      <td className="px-4 py-2.5 mono text-xs text-foreground/55">
                        {e.kinds?.join(" + ") || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.kinds?.includes("node") ? (
                          <Pill on={e.nodeOnline} onLabel="online" offLabel="offline" />
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.kinds?.includes("compute") ? (
                          <span className="mono text-xs text-foreground/60">
                            {e.computeStatus ?? "idle"}
                            {e.replicas > 0
                              ? ` · ${e.freeSlots}/${e.replicas}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-foreground/55">{e.class}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`mono inline-block rounded-full px-2 py-0.5 text-[0.6rem] tracking-wider uppercase ${
        on
          ? "bg-emerald-500/20 text-status-ok"
          : "bg-surface-2 text-muted"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}
