import { FormEvent, useEffect, useRef, useState } from "react";
import { editableForm, schemeChip } from "../lib/url";

interface Props {
  displayUrl: string;
  loading?: boolean;
  onNavigate: (input: string) => void;
  onFocusChange?: (focused: boolean) => void;
}

export function Omnibox({ displayUrl, loading, onNavigate, onFocusChange }: Props) {
  const [value, setValue] = useState(editableForm(displayUrl));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setValue(editableForm(displayUrl));
    }
  }, [displayUrl, focused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chip = schemeChip(displayUrl.startsWith("http") ? displayUrl : `grid://${value}`);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next) return;
    onNavigate(next);
    inputRef.current?.blur();
  }

  return (
    <form
      data-no-drag
      onSubmit={submit}
      className="titlebar-no-drag flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 transition focus-within:border-foreground/30 focus-within:bg-surface-2"
    >
      <span
        className={`mono shrink-0 text-[0.65rem] tracking-widest uppercase ${
          chip === "grid" ? "text-foreground/70" : "text-chip-legacy"
        }`}
        title={chip === "grid" ? "MESH · grid://" : "Legacy web"}
      >
        {chip === "grid" ? "grid://" : chip === "…" ? "grid://" : `${chip}://`}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        onBlur={() => {
          setFocused(false);
          onFocusChange?.(false);
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="type a realm · x → grid://x.grid"
        className="mono min-w-0 flex-1 bg-transparent text-[0.85rem] text-foreground/90 outline-none placeholder:text-dim"
        aria-label="Address"
      />
      {loading && (
        <span className="mono text-[0.6rem] tracking-widest text-dim uppercase">
          …
        </span>
      )}
    </form>
  );
}
