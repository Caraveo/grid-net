import { useTheme } from "../lib/ThemeContext";
import type { Theme } from "../lib/theme";

export function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://settings.grid
      </p>
      <h1 className="mt-3 text-3xl font-thin tracking-wide">Settings</h1>
      <p className="mt-3 text-muted">Appearance for MESH on this machine.</p>

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
    </div>
  );
}
