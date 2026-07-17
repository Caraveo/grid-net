/** Display helpers for the omnibox. */

export function schemeChip(displayUrl: string): "grid" | "https" | "http" | "…" {
  if (displayUrl.startsWith("grid://")) return "grid";
  if (displayUrl.startsWith("https://")) return "https";
  if (displayUrl.startsWith("http://")) return "http";
  return "…";
}

/** What to show in the bar while editing — prefer short form for grid hosts. */
export function editableForm(displayUrl: string): string {
  if (!displayUrl.startsWith("grid://")) return displayUrl;
  // grid://x.grid/ → x.grid  or  grid://x.grid/path → x.grid/path
  const rest = displayUrl.slice("grid://".length);
  if (rest.endsWith("/") && rest.indexOf("/") === rest.length - 1) {
    return rest.slice(0, -1);
  }
  return rest;
}
