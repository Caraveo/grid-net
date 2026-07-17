import { FormEvent, useEffect, useState } from "react";
import { listNames, setName } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import type { Theme } from "../lib/theme";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [names, setNames] = useState<[string, string][]>([]);
  const [label, setLabel] = useState("");
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function refresh() {
    setNames(await listNames());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const next = await setName(label.trim(), origin.trim());
      setNames(next);
      setLabel("");
      setOrigin("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://settings.grid
      </p>
      <h1 className="mt-3 text-3xl font-thin tracking-wide">Settings</h1>
      <p className="mt-3 text-muted">
        Appearance and local compute names for MESH.
      </p>

      {/* Theme */}
      <section className="mt-10 rounded-xl border border-border bg-surface p-5">
        <h2 className="mono text-[0.65rem] tracking-[0.2em] text-muted uppercase">
          Appearance
        </h2>
        <p className="mt-2 text-sm text-muted">
          Light or dark chrome. Preference is saved on this machine.
        </p>
        <div className="mt-4 flex gap-2">
          {(
            [
              { id: "light" as Theme, label: "Light" },
              { id: "dark" as Theme, label: "Dark" },
            ] as const
          ).map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-foreground/25 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="mt-12 mono text-[0.65rem] tracking-[0.2em] text-muted uppercase">
        Local realms
      </h2>
      <p className="mt-2 text-sm text-muted">
        Map a realm to an origin. Typing{" "}
        <span className="mono text-foreground/80">x</span> opens that origin as{" "}
        <span className="mono text-foreground/80">grid://x.grid</span>.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
      >
        <div>
          <label className="mono text-[0.65rem] tracking-wider text-muted uppercase">
            Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="x"
            className="mono mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
          />
        </div>
        <div>
          <label className="mono text-[0.65rem] tracking-wider text-muted uppercase">
            Origin
          </label>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="http://127.0.0.1:8080"
            className="mono mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && (
          <p className="text-sm text-muted">Saved to ~/.grid/browser/names.toml</p>
        )}
        <button type="submit" className="btn btn-primary">
          Save name
        </button>
      </form>

      {names.length === 0 ? (
        <p className="mt-6 text-muted">No names yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
          {names.map(([n, o]) => (
            <li
              key={n}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between"
            >
              <span className="mono text-sm text-foreground/90">{n}.grid</span>
              <span className="mono break-all text-xs text-muted">{o}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
