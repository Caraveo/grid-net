interface Props {
  title?: string;
  message: string;
  label?: string;
  onGo: (input: string) => void;
}

export function ErrorPage({
  title = "Not found",
  message,
  label,
  onGo,
}: Props) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
      <div className="relative z-10 max-w-md text-center">
        <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
          {label ? `grid://${label}.grid` : "grid://"}
        </p>
        <h1 className="mt-4 text-3xl font-thin tracking-wide text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-foreground/55 leading-relaxed">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => onGo("home")}>
            Home
          </button>
          <button type="button" className="btn" onClick={() => onGo("registry")}>
            Registry
          </button>
          <button type="button" className="btn" onClick={() => onGo("help")}>
            Help
          </button>
        </div>
      </div>
    </div>
  );
}
