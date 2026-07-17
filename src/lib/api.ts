import { invoke } from "@tauri-apps/api/core";
import type {
  BrowserStatus,
  ComputesResponse,
  GridUrl,
  NavigateResult,
  PublicCompute,
  RegistrySnapshot,
  ResolveHit,
} from "./types";

const REGISTRY = "https://grid-compute.com";

/** Soft-fail when running in plain Vite (no Tauri). */
async function tryInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

export async function navigate(input: string): Promise<NavigateResult> {
  try {
    return await tryInvoke<NavigateResult>("navigate", { input });
  } catch {
    return clientNavigate(input);
  }
}

export async function normalizeUrl(input: string): Promise<GridUrl> {
  try {
    return await tryInvoke<GridUrl>("normalize_url", { input });
  } catch {
    const r = await clientNavigate(input);
    if (!r.url) throw new Error(r.error ?? "invalid");
    return r.url;
  }
}

export async function browserStatus(): Promise<BrowserStatus | null> {
  try {
    return await tryInvoke<BrowserStatus>("browser_status");
  } catch {
    return null;
  }
}

export async function registrySnapshot(): Promise<RegistrySnapshot | null> {
  try {
    return await tryInvoke<RegistrySnapshot>("registry_snapshot");
  } catch {
    try {
      const res = await fetch(`${REGISTRY}/api/registry`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as RegistrySnapshot;
      if (!data.computes?.length) {
        const c = await fetchComputes(false);
        if (c) {
          data.computes = c.computes;
          data.computeStats = c.stats;
        }
      }
      return data;
    } catch {
      return null;
    }
  }
}

export async function fetchComputes(
  availableOnly = false,
): Promise<ComputesResponse | null> {
  try {
    return await tryInvoke<ComputesResponse>("list_computes", {
      availableOnly,
    });
  } catch {
    try {
      const q = availableOnly ? "?available=1" : "";
      const res = await fetch(`${REGISTRY}/api/registry/computes${q}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as ComputesResponse;
    } catch {
      return null;
    }
  }
}

export async function listNames(): Promise<[string, string][]> {
  try {
    return await tryInvoke<[string, string][]>("list_names");
  } catch {
    return [];
  }
}

export async function setName(
  label: string,
  origin: string,
): Promise<[string, string][]> {
  return tryInvoke<[string, string][]>("set_name", { label, origin });
}

function pickCompute(
  computes: PublicCompute[],
  label: string,
): PublicCompute | null {
  const matches = computes.filter(
    (c) => c.name.toLowerCase() === label.toLowerCase(),
  );
  if (!matches.length) return null;
  return (
    matches.find((c) => c.status === "available" && c.visibility === "public") ??
    matches.find((c) => c.status === "available") ??
    matches.find((c) => c.visibility === "public") ??
    matches[0]
  );
}

function meshHit(label: string, c: PublicCompute): ResolveHit {
  return {
    kind: "mesh",
    label,
    computeId: c.id,
    name: c.name,
    nodeId: c.nodeId,
    image: c.image,
    visibility: c.visibility,
    status: c.status,
    freeSlots: c.freeSlots ?? 0,
    replicas: c.replicas ?? 1,
    class: c.class,
    backend: c.backend ?? "docker",
  };
}

/** Client-side mirror for Vite-only previews (includes mesh lookup). */
async function clientNavigate(input: string): Promise<NavigateResult> {
  const raw = input.trim();
  if (!raw) {
    return {
      input,
      url: null,
      hit: { kind: "error", message: "empty address" },
      error: "empty address",
    };
  }
  const lower = raw.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    const url: GridUrl = {
      scheme: lower.startsWith("https") ? "https" : "http",
      label: "",
      host: "",
      path: "/",
      query: null,
      fragment: null,
      display: raw,
    };
    try {
      const u = new URL(raw);
      url.host = u.host;
      url.path = u.pathname || "/";
      url.query = u.search ? u.search.slice(1) : null;
      url.fragment = u.hash ? u.hash.slice(1) : null;
      url.display = u.toString();
    } catch {
      /* keep raw */
    }
    return {
      input,
      url,
      hit: { kind: "legacy", url: url.display },
      error: null,
    };
  }

  let rest = raw;
  if (lower.startsWith("grid://")) rest = raw.slice("grid://".length);
  else if (lower.startsWith("grid:")) rest = raw.slice("grid:".length);

  const pathIdx = rest.search(/[/?#]/);
  const hostPart = (pathIdx >= 0 ? rest.slice(0, pathIdx) : rest)
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
  const pathRest = pathIdx >= 0 ? rest.slice(pathIdx) : "/";

  let label = hostPart.endsWith(".grid")
    ? hostPart.slice(0, -".grid".length)
    : hostPart;

  if (!label || label.includes(".")) {
    return {
      input,
      url: null,
      hit: { kind: "error", message: `invalid GRID name: ${hostPart}` },
      error: `invalid GRID name: ${hostPart}`,
    };
  }

  const path = pathRest.startsWith("/")
    ? pathRest.split(/[?#]/)[0] || "/"
    : `/${pathRest.split(/[?#]/)[0]}`;

  const display = `grid://${label}.grid${path === "" ? "/" : path}`;
  const url: GridUrl = {
    scheme: "grid",
    label,
    host: `${label}.grid`,
    path: path || "/",
    query: null,
    fragment: null,
    display,
  };

  const builtins: Record<string, BuiltinPageAlias> = {
    home: "home",
    start: "home",
    newtab: "home",
    registry: "registry",
    mesh: "registry",
    peers: "registry",
    computes: "registry",
    status: "status",
    about: "status",
    help: "help",
    docs: "help",
    settings: "settings",
    config: "settings",
    prefs: "settings",
    error: "error",
  };

  type BuiltinPageAlias =
    | "home"
    | "registry"
    | "status"
    | "help"
    | "settings"
    | "error";

  const page = builtins[label];
  if (page) {
    return {
      input,
      url,
      hit: { kind: "builtin", page, label },
      error: null,
    };
  }

  // Public mesh compute lookup
  const computes = (await fetchComputes(false))?.computes ?? [];
  const found = pickCompute(computes, label);
  if (found) {
    return {
      input,
      url,
      hit: meshHit(label, found),
      error: null,
    };
  }

  return {
    input,
    url,
    hit: {
      kind: "not_found",
      label,
      message: `Compute «${label}» not found on the mesh — try registry.grid`,
    },
    error: null,
  };
}
