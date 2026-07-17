import { useCallback, useEffect, useMemo, useState } from "react";
import { Chrome } from "./components/Chrome";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { Viewport } from "./components/Viewport";
import { browserStatus, navigate, registrySnapshot } from "./lib/api";
import { createTab, titleFromHit, type Tab } from "./lib/tabs";
import { useTheme } from "./lib/ThemeContext";
import type { BrowserStatus } from "./lib/types";

function updateTab(tabs: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return tabs.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0]!.id);
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [peerCount, setPeerCount] = useState<number | null>(null);
  const [computeCount, setComputeCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  const active = useMemo(
    () => tabs.find((t) => t.id === activeId) ?? tabs[0]!,
    [tabs, activeId],
  );

  useEffect(() => {
    browserStatus().then(setStatus);
    registrySnapshot().then((snap) => {
      if (!snap) return;
      setPhase(snap.phase ?? null);
      const nodes = [...(snap.nodes ?? []), ...(snap.peers ?? [])];
      const unique = new Set(nodes.map((n) => n.id));
      setPeerCount(unique.size);
      setComputeCount(
        snap.computeStats?.total ?? snap.computes?.length ?? null,
      );
    });
  }, []);

  const go = useCallback(
    async (
      input: string,
      opts?: {
        pushHistory?: boolean;
        tabId?: string;
        /** Jump to this history index (back/forward) without pushing. */
        historyIndex?: number;
      },
    ) => {
      const tabId = opts?.tabId ?? activeId;
      const pushHistory = opts?.pushHistory ?? true;

      setTabs((prev) => updateTab(prev, tabId, { loading: true }));

      try {
        const result = await navigate(input);
        const displayUrl = result.url?.display ?? input;
        const hit = result.hit;

        setTabs((prev) => {
          const tab = prev.find((t) => t.id === tabId);
          if (!tab) return prev;

          let history = tab.history;
          let historyIndex = tab.historyIndex;
          if (typeof opts?.historyIndex === "number") {
            historyIndex = opts.historyIndex;
          } else if (pushHistory) {
            const base = tab.history.slice(0, tab.historyIndex + 1);
            history = [...base, input];
            historyIndex = history.length - 1;
          }

          return updateTab(prev, tabId, {
            loading: false,
            displayUrl,
            input,
            hit,
            title: titleFromHit(hit, displayUrl, input),
            history,
            historyIndex,
          });
        });
      } catch {
        setTabs((prev) =>
          updateTab(prev, tabId, {
            loading: false,
            hit: { kind: "error", message: "Navigation failed" },
            title: "Error",
          }),
        );
      }
    },
    [activeId],
  );

  // Initial resolve for first tab
  useEffect(() => {
    void go("home", { pushHistory: false, tabId: activeId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newTab = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    void go("home", { pushHistory: false, tabId: tab.id });
  }, [go]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          // Reset last tab to home instead of closing the window
          const only = prev[0]!;
          const fresh = createTab({ id: only.id });
          queueMicrotask(() => {
            void go("home", { pushHistory: false, tabId: only.id });
          });
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) {
          const fallback = next[Math.max(0, idx - 1)] ?? next[0]!;
          setActiveId(fallback.id);
        }
        return next;
      });
    },
    [activeId, go],
  );

  const selectTab = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "t") {
        e.preventDefault();
        newTab();
        return;
      }
      if (key === "w") {
        e.preventDefault();
        closeTab(activeId);
        return;
      }
      if (key === "r") {
        e.preventDefault();
        const cur = active.history[active.historyIndex];
        if (cur) void go(cur, { pushHistory: false });
        return;
      }
      // ⌘1–⌘9 switch tab
      if (e.key >= "1" && e.key <= "9") {
        const i = Number(e.key) - 1;
        if (tabs[i]) {
          e.preventDefault();
          setActiveId(tabs[i]!.id);
        }
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab
      if (key === "tab") {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        if (idx < 0) return;
        const next = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length;
        setActiveId(tabs[next]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, activeId, closeTab, go, newTab, tabs]);

  const canBack = active.historyIndex > 0;
  const canForward = active.historyIndex < active.history.length - 1;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TabBar
        tabs={tabs}
        activeId={active.id}
        onSelect={selectTab}
        onClose={closeTab}
        onNew={newTab}
        onReorder={reorderTabs}
      />

      <Chrome
        displayUrl={active.displayUrl}
        canBack={canBack}
        canForward={canForward}
        loading={active.loading}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={() => {
          if (!canBack) return;
          const i = active.historyIndex - 1;
          const input = active.history[i];
          if (input) void go(input, { pushHistory: false, historyIndex: i });
        }}
        onForward={() => {
          if (!canForward) return;
          const i = active.historyIndex + 1;
          const input = active.history[i];
          if (input) void go(input, { pushHistory: false, historyIndex: i });
        }}
        onReload={() => {
          const cur = active.history[active.historyIndex];
          if (cur) void go(cur, { pushHistory: false });
        }}
        onHome={() => void go("home")}
        onNavigate={(input) => void go(input)}
      />

      <main className="relative min-h-0 flex-1 overflow-y-auto bg-background">
        <Viewport
          hit={active.hit}
          peerCount={peerCount}
          computeCount={computeCount}
          phase={phase}
          onGo={(input) => void go(input)}
        />
      </main>

      <StatusBar
        status={status}
        hit={active.hit}
        peerCount={peerCount}
        computeCount={computeCount}
        phase={phase}
      />
    </div>
  );
}
