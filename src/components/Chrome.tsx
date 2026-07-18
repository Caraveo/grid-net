import type { ReactNode } from "react";
import { LightWallet } from "./LightWallet";
import { Omnibox } from "./Omnibox";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../lib/theme";
import { onChromePointerDown } from "../lib/window";

interface Props {
  displayUrl: string;
  canBack: boolean;
  canForward: boolean;
  loading: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onHome: () => void;
  onNavigate: (input: string) => void;
}

function NavBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-no-drag
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="titlebar-no-drag flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition hover:bg-surface-2 hover:text-foreground disabled:cursor-default disabled:opacity-25"
    >
      {children}
    </button>
  );
}

export function Chrome({
  displayUrl,
  canBack,
  canForward,
  loading,
  theme,
  onToggleTheme,
  onBack,
  onForward,
  onReload,
  onHome,
  onNavigate,
}: Props) {
  return (
    <header
      data-tauri-drag-region
      className="titlebar-drag flex h-[var(--chrome-h)] shrink-0 items-center gap-2 border-b border-border bg-chrome px-3 backdrop-blur"
      onPointerDown={onChromePointerDown}
    >
      <div className="flex items-center gap-0.5">
        <NavBtn label="Back" disabled={!canBack} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavBtn>
        <NavBtn label="Forward" disabled={!canForward} onClick={onForward}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavBtn>
        <NavBtn label="Reload" onClick={onReload}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M13 8a5 5 0 1 1-1.2-3.2M13 3v3.5H9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavBtn>
        <NavBtn label="Home" onClick={onHome}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 8L8 3l5.5 5M4 7.5V13h8V7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </NavBtn>
      </div>

      <Omnibox displayUrl={displayUrl} loading={loading} onNavigate={onNavigate} />

      {/* GRID light wallet balance (click → popup) */}
      <LightWallet />

      <ThemeToggle theme={theme} onToggle={onToggleTheme} />

      <div className="mono hidden shrink-0 text-[0.6rem] tracking-[0.2em] text-dim uppercase sm:block">
        MESH
      </div>
    </header>
  );
}
