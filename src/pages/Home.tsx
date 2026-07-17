interface Props {
  onGo: (input: string) => void;
}

const LINKS = [
  { name: "home", hint: "this page" },
  { name: "registry", hint: "public computes + peers" },
  { name: "status", hint: "browser + mesh" },
  { name: "help", hint: "how grid:// works" },
  { name: "settings", hint: "names & gateway" },
];

export function Home({ onGo }: Props) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="noise" />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <p className="mono text-[0.65rem] tracking-[0.28em] text-muted uppercase">
          Access the Grid
        </p>
        <h1 className="mt-5 text-[clamp(3rem,12vw,5.5rem)] font-thin leading-none tracking-[0.32em]">
          MESH
        </h1>
        <p className="mt-5 max-w-md text-base text-foreground/55 leading-relaxed">
          Type a compute name. Default scheme is{" "}
          <span className="mono text-foreground/80">grid://</span>.
          <br />
          <span className="text-muted">
            <span className="mono text-foreground/70">x</span>
            {" → "}
            <span className="mono text-foreground/70">grid://x.grid</span>
          </span>
        </p>

        <div className="mt-10 flex w-full flex-col gap-2">
          {LINKS.map((l) => (
            <button
              key={l.name}
              type="button"
              onClick={() => onGo(l.name)}
              className="group flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition hover:border-foreground/25 hover:bg-surface-2"
            >
              <span className="mono text-sm text-foreground/90">
                grid://{l.name}.grid
              </span>
              <span className="text-xs text-dim group-hover:text-foreground/55">
                {l.hint}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-10 mono text-[0.6rem] tracking-[0.2em] text-dim uppercase">
          MESH · Transact Security Layer
        </p>
      </div>
    </div>
  );
}
