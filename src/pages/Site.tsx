/**
 * grid://grid.grid — public GRID site (https://grid-compute.com/)
 */
export function Site() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 hero-glow" />
      <div className="noise" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="mono text-[0.65rem] tracking-[0.25em] text-muted uppercase">
          grid://grid.grid
        </p>
        <p className="mt-10 text-2xl font-thin tracking-[0.35em] text-foreground/90 sm:text-3xl">
          Soon...
        </p>
        <a
          href="https://grid-compute.com/"
          target="_blank"
          rel="noreferrer"
          className="mono mt-10 text-[0.7rem] tracking-[0.18em] text-dim uppercase transition hover:text-foreground/70"
        >
          grid-compute.com
        </a>
      </div>
    </div>
  );
}
