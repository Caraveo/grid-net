interface Props {
  onGo: (input: string) => void;
}

export function Help({ onGo }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
        grid://help.grid
      </p>
      <h1 className="mt-3 text-3xl font-thin tracking-wide">How MESH addresses work</h1>

      <section className="mt-10 space-y-6 text-foreground/65 leading-relaxed">
        <div>
          <h2 className="text-sm tracking-widest text-foreground/90 uppercase">
            Default scheme
          </h2>
          <p className="mt-2">
            This browser defaults to <code className="mono text-foreground/90">grid://</code>,
            not https. The mesh is the primary web.
          </p>
        </div>

        <div>
          <h2 className="text-sm tracking-widest text-foreground/90 uppercase">
            Bare names
          </h2>
          <p className="mt-2">
            Type a compute label — no extension required:
          </p>
          <pre className="mono mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-4 text-sm text-foreground/85">
{`x              →  grid://x.grid/
x.grid         →  grid://x.grid/
grid://x       →  grid://x.grid/
grid://x.grid  →  grid://x.grid/`}
          </pre>
          <p className="mt-3">
            That label is the handle for a <strong className="font-normal text-foreground/90">compute / node / published site</strong>{" "}
            on the mesh — same mental model as{" "}
            <code className="mono text-foreground/80">grid launch x</code>.
          </p>
        </div>

        <div>
          <h2 className="text-sm tracking-widest text-foreground/90 uppercase">
            Built-in sites
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <button type="button" className="mono text-foreground/90 underline-offset-2 hover:underline" onClick={() => onGo("home")}>
                home
              </button>
            </li>
            <li>
              <button type="button" className="mono text-foreground/90 underline-offset-2 hover:underline" onClick={() => onGo("registry")}>
                registry
              </button>
            </li>
            <li>
              <button type="button" className="mono text-foreground/90 underline-offset-2 hover:underline" onClick={() => onGo("status")}>
                status
              </button>
            </li>
            <li>
              <button type="button" className="mono text-foreground/90 underline-offset-2 hover:underline" onClick={() => onGo("settings")}>
                settings
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm tracking-widest text-foreground/90 uppercase">
            Local names
          </h2>
          <p className="mt-2">
            Map computes in{" "}
            <code className="mono text-foreground/80">~/.grid/browser/names.toml</code>:
          </p>
          <pre className="mono mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-4 text-sm text-foreground/85">
{`[names]
x = "http://127.0.0.1:8080"
garage = "https://example.com"`}
          </pre>
        </div>

        <div>
          <h2 className="text-sm tracking-widest text-foreground/90 uppercase">
            CLI
          </h2>
          <p className="mt-2">
            Install the GRID node from{" "}
            <a
              className="text-foreground/90 underline-offset-2 hover:underline"
              href="https://github.com/Caraveo/grid"
              target="_blank"
              rel="noreferrer"
            >
              github.com/Caraveo/grid
            </a>
            . Public mesh registry:{" "}
            <a
              className="text-foreground/90 underline-offset-2 hover:underline"
              href="https://grid-compute.com"
              target="_blank"
              rel="noreferrer"
            >
              grid-compute.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
