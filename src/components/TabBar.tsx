import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Tab } from "../lib/tabs";
import { isNoDragTarget, startWindowDrag } from "../lib/window";

interface Props {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  onReorder,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  function indexFromClientX(clientX: number): number {
    const row = rowRef.current;
    if (!row) return 0;
    const nodes = row.querySelectorAll<HTMLElement>("[data-tab-id]");
    for (let i = 0; i < nodes.length; i++) {
      const rect = nodes[i]!.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (clientX < mid) return i;
    }
    return nodes.length;
  }

  /** Any empty chrome under the tab bar moves the window immediately. */
  function onBarPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    if (isNoDragTarget(e.target)) return;
    // Don't steal from tab pills — they have their own gesture handler
    if ((e.target as Element).closest?.("[data-tab-id]")) return;
    startWindowDrag();
  }

  function onTabPointerDown(
    e: ReactPointerEvent,
    index: number,
    id: string,
  ) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let mode: "pending" | "window" | "reorder" = "pending";

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (mode === "pending") {
        if (adx < 4 && ady < 4) return;
        // Default bias: any non-tiny movement starts window drag,
        // unless clearly horizontal (tab reorder).
        if (adx > ady * 1.4 && adx > 10) {
          mode = "reorder";
          setDraggingId(id);
          setDropIndex(indexFromClientX(ev.clientX));
          return;
        }
        mode = "window";
        cleanup();
        startWindowDrag();
        return;
      }
      if (mode === "reorder") {
        setDropIndex(indexFromClientX(ev.clientX));
      }
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();
      if (mode === "pending") {
        onSelect(id);
        return;
      }
      if (mode === "reorder") {
        const rawTo = indexFromClientX(ev.clientX);
        let target = rawTo;
        if (index < rawTo) target = rawTo - 1;
        if (target !== index && target >= 0 && target < tabs.length) {
          onReorder(index, target);
        }
      }
      setDraggingId(null);
      setDropIndex(null);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      data-tauri-drag-region
      className="titlebar-drag flex shrink-0 flex-col border-b border-border bg-background"
      onPointerDown={onBarPointerDown}
    >
      {/* Full-width always-drag strip (traffic-light clearance) */}
      <div
        data-tauri-drag-region
        className="titlebar-drag h-3 w-full shrink-0 pl-[78px]"
      />

      <div className="flex h-8 items-stretch pl-[78px] pr-1">
        <div
          ref={rowRef}
          className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
        >
          {tabs.map((tab, index) => {
            const active = tab.id === activeId;
            const isDragging = draggingId === tab.id;
            const showDropBefore =
              dropIndex === index &&
              draggingId !== null &&
              draggingId !== tab.id;

            return (
              <div key={tab.id} className="relative flex shrink-0 items-end">
                {showDropBefore && (
                  <span
                    aria-hidden
                    className="absolute -left-0.5 top-1 bottom-1 z-10 w-0.5 rounded-full bg-foreground/80"
                  />
                )}
                <div
                  role="tab"
                  data-tab-id={tab.id}
                  data-no-drag
                  aria-selected={active}
                  onPointerDown={(e) => onTabPointerDown(e, index, tab.id)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      onClose(tab.id);
                    }
                  }}
                  className={`titlebar-no-drag group relative flex h-8 max-w-[180px] min-w-[96px] cursor-default items-center gap-1 rounded-t-lg px-2.5 text-left select-none transition ${
                    isDragging ? "opacity-40" : ""
                  } ${
                    active
                      ? "bg-surface-2 text-foreground"
                      : "bg-transparent text-muted hover:bg-surface hover:text-foreground/70"
                  }`}
                >
                  {tab.loading && (
                    <span className="mono shrink-0 text-[0.55rem] text-dim">
                      …
                    </span>
                  )}
                  <span className="mono min-w-0 flex-1 truncate text-[0.7rem] tracking-wide">
                    {tab.title}
                  </span>
                  <button
                    type="button"
                    data-no-drag
                    aria-label={`Close ${tab.title}`}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(tab.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`titlebar-no-drag flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted transition hover:bg-surface-2 hover:text-foreground ${
                      active
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path
                        d="M1 1l6 6M7 1L1 7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {dropIndex === tabs.length && draggingId !== null && (
            <span
              aria-hidden
              className="mb-1 h-6 w-0.5 shrink-0 rounded-full bg-foreground/80"
            />
          )}

          <button
            type="button"
            data-no-drag
            aria-label="New tab"
            title="New tab (⌘T)"
            onClick={onNew}
            className="titlebar-no-drag mb-0.5 ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Always-reserved drag zone */}
        <div
          data-tauri-drag-region
          className="titlebar-drag w-14 shrink-0 self-stretch sm:w-20"
        />
      </div>
    </div>
  );
}
