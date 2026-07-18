import { useEffect, useState } from "react";
import { browserStatus } from "../lib/api";
import type { BrowserStatus } from "../lib/types";

interface Props {
  peerCount?: number | null;
  computeCount?: number | null;
  phase?: string | null;
}

export function Status({ peerCount, computeCount, phase }: Props) {
  const [status, setStatus] = useState<BrowserStatus | null>(null);

  useEffect(() => {
    browserStatus().then(setStatus);
  }, []);

  const rows: [string, string][] = [
    ["Product", status?.product ?? "MESH"],
    ["Version", status?.version ?? "—"],
    ["Default scheme", status?.defaultScheme ?? "grid"],
    ["Registry", "grid-compute.com"],
    ["Mesh phase", phase ?? "1"],
    ["Peers", peerCount != null ? String(peerCount) : "—"],
    ["Computes", computeCount != null ? String(computeCount) : "—"],
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://status.grid
      </p>
      <h1 className="mt-3 text-3xl font-thin tracking-wide">Status</h1>
      <p className="mt-3 text-muted">
        Browser identity and mesh linkage.
      </p>

      <dl className="mt-10 divide-y divide-border rounded-xl border border-border bg-surface">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <dt className="mono text-[0.65rem] tracking-wider text-muted uppercase">
              {k}
            </dt>
            <dd className="mono break-all text-sm text-foreground/85">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
