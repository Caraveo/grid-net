import type { ResolveHit } from "./types";

export interface Tab {
  id: string;
  title: string;
  displayUrl: string;
  input: string;
  hit: ResolveHit | null;
  loading: boolean;
  history: string[];
  historyIndex: number;
}

let tabSeq = 0;

export function newTabId(): string {
  tabSeq += 1;
  return `tab-${Date.now()}-${tabSeq}`;
}

export function createTab(partial?: Partial<Tab>): Tab {
  return {
    id: newTabId(),
    title: "Home",
    displayUrl: "grid://home.grid/",
    input: "home",
    hit: { kind: "builtin", page: "home", label: "home" },
    loading: false,
    history: ["home"],
    historyIndex: 0,
    ...partial,
  };
}

/** Derive a short tab title from a resolve hit / display URL. */
export function titleFromHit(
  hit: ResolveHit | null,
  _displayUrl: string,
  input: string,
): string {
  if (!hit) return shortLabel(input) || "New tab";
  switch (hit.kind) {
    case "builtin":
      return capitalize(hit.page);
    case "local":
    case "gateway":
    case "mesh":
      return hit.label;
    case "legacy": {
      try {
        return new URL(hit.url).hostname || "Web";
      } catch {
        return "Web";
      }
    }
    case "not_found":
      return hit.label || "Not found";
    case "error":
      return "Error";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortLabel(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (t.startsWith("grid://")) {
    const host = t.slice("grid://".length).split("/")[0] ?? "";
    return host.replace(/\.grid$/i, "") || host;
  }
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      return new URL(t).hostname;
    } catch {
      return t.slice(0, 24);
    }
  }
  return t.split("/")[0]?.replace(/\.grid$/i, "") || t;
}
