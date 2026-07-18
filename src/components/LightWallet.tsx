import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  applySend,
  createLightWallet,
  demoCredit,
  formatGrid,
  getWalletInfo,
  isGrid0Address,
  loadStore,
  type LightWalletInfo,
  type SessionWallet,
  revealWalletDirectory,
  unlockLightWallet,
  wipeLightWallet,
} from "../lib/light-wallet";

type Panel = "main" | "receive" | "send1" | "send2";

/**
 * Top-right GRID balance chip + dismissable light-wallet popup.
 * Keys on iCloud (Mac) or local directory (Linux/Windows).
 */
export function LightWallet() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionWallet | null>(null);
  const [hasStore, setHasStore] = useState(false);
  const [cachedBalance, setCachedBalance] = useState<number | null>(null);
  const [info, setInfo] = useState<LightWalletInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("main");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sendMemo, setSendMemo] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [store, winfo] = await Promise.all([loadStore(), getWalletInfo()]);
    setHasStore(!!store || winfo.exists);
    setCachedBalance(store?.balance ?? null);
    setInfo(winfo);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPanel("main");
        setErr(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("main");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!session || panel !== "receive") {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(session.address, {
      width: 168,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [session, panel]);

  const balanceLabel = useMemo(() => {
    if (session) return formatGrid(session.balance);
    if (cachedBalance != null) return formatGrid(cachedBalance);
    return "—";
  }, [session, cachedBalance]);

  async function handleCreate() {
    setBusy(true);
    setErr(null);
    try {
      const w = await createLightWallet();
      setSession(w);
      setHasStore(true);
      setCachedBalance(w.balance);
      setPanel("main");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create wallet");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    setErr(null);
    try {
      const w = await unlockLightWallet();
      setSession(w);
      setCachedBalance(w.balance);
      setPanel("main");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Passkey unlock failed");
    } finally {
      setBusy(false);
    }
  }

  function handleLock() {
    setSession(null);
    setPanel("main");
    setErr(null);
  }

  async function handleWipe() {
    if (
      !confirm(
        "Wipe this light wallet file? Keys + grid0 on this storage path will be gone.",
      )
    ) {
      return;
    }
    await wipeLightWallet();
    setSession(null);
    setHasStore(false);
    setCachedBalance(null);
    setPanel("main");
    await refresh();
  }

  async function handleReveal() {
    setErr(null);
    const path = await revealWalletDirectory();
    if (!path) {
      setErr("Open folder only works in the MESH app (not plain browser).");
    }
  }

  function goSendStep2() {
    setErr(null);
    const to = sendTo.trim().toLowerCase();
    const amt = Number(sendAmt);
    if (!isGrid0Address(to)) {
      setErr("Enter a valid grid0 address (starts with grid01…)");
      return;
    }
    if (!(amt > 0) || !Number.isFinite(amt)) {
      setErr("Enter a positive amount");
      return;
    }
    if (session && amt > session.balance) {
      setErr("Not enough GRID on this device");
      return;
    }
    setPanel("send2");
  }

  async function confirmSend() {
    if (!session) return;
    setErr(null);
    try {
      const next = await applySend(
        session,
        sendTo.trim().toLowerCase(),
        Number(sendAmt),
        sendMemo.trim() || undefined,
      );
      setSession(next);
      setCachedBalance(next.balance);
      setSendTo("");
      setSendAmt("");
      setSendMemo("");
      setPanel("main");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    }
  }

  async function addDemo() {
    if (!session) return;
    const next = await demoCredit(session, 12.5);
    setSession(next);
    setCachedBalance(next.balance);
  }

  const storageHint = info
    ? info.icloud
      ? "Keys & address sync via iCloud Drive when signed into iCloud."
      : info.platform === "macos"
        ? "iCloud Drive not found — storing on this Mac only."
        : "Keys live in a local folder on this computer."
    : null;

  return (
    <div ref={rootRef} className="relative titlebar-no-drag" data-no-drag>
      <button
        type="button"
        data-no-drag
        onClick={() => {
          setOpen((o) => !o);
          setErr(null);
          setPanel("main");
        }}
        className="titlebar-no-drag flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-foreground/25 bg-surface px-2.5 mono text-[0.7rem] tabular-nums tracking-wide text-foreground transition hover:border-foreground/50 hover:bg-surface-2"
        title="GRID light wallet — send & receive"
        aria-label="GRID light wallet balance"
        aria-expanded={open}
      >
        <span className="text-[0.55rem] font-semibold tracking-[0.14em] text-dim uppercase">
          GRID
        </span>
        <span className="min-w-[2.25rem] text-right font-semibold">
          {balanceLabel === "—" ? "0" : balanceLabel}
        </span>
      </button>

      {open && (
        <div
          data-no-drag
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-chrome shadow-2xl shadow-black/40"
          role="dialog"
          aria-label="Light wallet"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-dim uppercase">
                Light wallet
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                GRID on this device
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs text-dim transition hover:bg-surface-2 hover:text-foreground"
              onClick={() => {
                setOpen(false);
                setPanel("main");
              }}
            >
              Dismiss
            </button>
          </div>

          <div className="px-4 py-3">
            <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-amber-100/90">
              Your GRID lives on <strong className="text-foreground">this device</strong>
              {info?.icloud ? " (backed by iCloud Drive)" : ""}. Lose the device or
              forget your passkey →{" "}
              <strong className="text-foreground">lose your GRID</strong>. Disposable —
              spend on mesh sites.
            </div>

            {/* Storage location */}
            {info && (
              <div className="mb-3 rounded-xl border border-border bg-surface px-3 py-2">
                <p className="text-[0.6rem] font-semibold tracking-[0.14em] text-dim uppercase">
                  {info.icloud ? "iCloud" : "Wallet directory"}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-foreground/90">
                  {info.storageLabel}
                </p>
                {/* Always show path on Linux/Windows; on Mac show when not iCloud or always compact */}
                {(!info.icloud || info.platform !== "macos") && (
                  <p className="mt-1 break-all mono text-[0.58rem] leading-snug text-dim">
                    {info.directory}
                  </p>
                )}
                {info.icloud && (
                  <p className="mt-1 mono text-[0.58rem] text-dim">
                    iCloud Drive → MESH → light-wallet.json
                  </p>
                )}
                {storageHint && (
                  <p className="mt-1 text-[0.65rem] text-dim">{storageHint}</p>
                )}
                {!info.icloud && info.platform !== "web" && (
                  <button
                    type="button"
                    onClick={() => void handleReveal()}
                    className="mt-2 text-[0.65rem] font-semibold text-foreground/80 underline-offset-2 hover:underline"
                  >
                    Open folder…
                  </button>
                )}
              </div>
            )}

            {err && (
              <p className="mb-2 rounded-lg bg-danger/15 px-2.5 py-1.5 text-[0.7rem] text-danger">
                {err}
              </p>
            )}

            {!session && (
              <div className="space-y-2">
                {hasStore ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleUnlock()}
                    className="w-full rounded-xl bg-[var(--btn-primary-bg)] py-2.5 text-sm font-semibold text-[var(--btn-primary-fg)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Passkey…" : "Unlock with passkey"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCreate()}
                    className="w-full rounded-xl bg-[var(--btn-primary-bg)] py-2.5 text-sm font-semibold text-[var(--btn-primary-fg)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Creating…" : "Create with passkey"}
                  </button>
                )}
                <p className="text-center text-[0.65rem] text-dim">
                  Passkey · keys file on disk
                  {info?.icloud ? " (iCloud)" : ""} · no recovery seed
                </p>
              </div>
            )}

            {session && panel === "main" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
                  <p className="text-[0.6rem] tracking-[0.16em] text-dim uppercase">
                    Balance
                  </p>
                  <p className="mt-1 mono text-2xl font-semibold tabular-nums tracking-tight">
                    {formatGrid(session.balance)}{" "}
                    <span className="text-sm font-normal text-dim">GRID</span>
                  </p>
                </div>

                <p className="break-all mono text-[0.6rem] leading-relaxed text-dim">
                  {session.address}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel("receive")}
                    className="rounded-xl border border-border py-2 text-xs font-semibold transition hover:bg-surface-2"
                  >
                    Receive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel("send1");
                      setErr(null);
                    }}
                    className="rounded-xl border border-border py-2 text-xs font-semibold transition hover:bg-surface-2"
                  >
                    Send
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void addDemo()}
                  className="w-full text-[0.65rem] text-dim underline-offset-2 hover:text-muted hover:underline"
                >
                  + demo 12.5 GRID (this device only)
                </button>

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={handleLock}
                    className="text-[0.65rem] text-dim hover:text-foreground"
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleWipe()}
                    className="text-[0.65rem] text-danger/80 hover:text-danger"
                  >
                    Wipe wallet file
                  </button>
                </div>
              </div>
            )}

            {session && panel === "receive" && (
              <div className="space-y-3">
                <button
                  type="button"
                  className="text-[0.65rem] text-dim hover:text-foreground"
                  onClick={() => setPanel("main")}
                >
                  ← Back
                </button>
                <p className="text-center text-xs text-muted">
                  Scan or copy · received GRID stays on this device storage
                </p>
                {qrDataUrl ? (
                  <div className="mx-auto w-fit rounded-xl bg-white p-2">
                    <img
                      src={qrDataUrl}
                      alt="grid0 receive QR"
                      width={168}
                      height={168}
                    />
                  </div>
                ) : (
                  <div className="mx-auto h-[168px] w-[168px] animate-pulse rounded-xl bg-surface" />
                )}
                <p className="break-all rounded-lg border border-border bg-surface px-2 py-2 mono text-[0.6rem] leading-relaxed">
                  {session.address}
                </p>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border py-2 text-xs font-semibold hover:bg-surface-2"
                  onClick={() => {
                    void navigator.clipboard.writeText(session.address);
                  }}
                >
                  Copy address
                </button>
              </div>
            )}

            {session && panel === "send1" && (
              <div className="space-y-3">
                <button
                  type="button"
                  className="text-[0.65rem] text-dim hover:text-foreground"
                  onClick={() => setPanel("main")}
                >
                  ← Back
                </button>
                <p className="text-[0.7rem] text-muted">
                  Step 1 of 2 — where & how much
                </p>
                <label className="block text-[0.65rem] text-dim">
                  To (grid0 address)
                  <input
                    data-no-drag
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="grid01…"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-2 mono text-[0.7rem] text-foreground outline-none focus:border-foreground/30"
                  />
                </label>
                <label className="block text-[0.65rem] text-dim">
                  Amount (GRID)
                  <input
                    data-no-drag
                    value={sendAmt}
                    onChange={(e) => setSendAmt(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-2 mono text-[0.7rem] text-foreground outline-none focus:border-foreground/30"
                  />
                </label>
                <label className="block text-[0.65rem] text-dim">
                  Memo (optional)
                  <input
                    data-no-drag
                    value={sendMemo}
                    onChange={(e) => setSendMemo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-[0.7rem] text-foreground outline-none focus:border-foreground/30"
                  />
                </label>
                <button
                  type="button"
                  onClick={goSendStep2}
                  className="w-full rounded-xl bg-[var(--btn-primary-bg)] py-2.5 text-sm font-semibold text-[var(--btn-primary-fg)]"
                >
                  Review send →
                </button>
              </div>
            )}

            {session && panel === "send2" && (
              <div className="space-y-3">
                <button
                  type="button"
                  className="text-[0.65rem] text-dim hover:text-foreground"
                  onClick={() => setPanel("send1")}
                >
                  ← Edit
                </button>
                <p className="text-[0.7rem] text-muted">
                  Step 2 of 2 — confirm
                </p>
                <div className="rounded-xl border border-border bg-surface px-3 py-3 text-[0.75rem] leading-relaxed">
                  <p>
                    <span className="text-dim">Send</span>{" "}
                    <strong className="mono">{sendAmt} GRID</strong>
                  </p>
                  <p className="mt-2 break-all">
                    <span className="text-dim">To</span>{" "}
                    <span className="mono text-[0.65rem]">{sendTo.trim()}</span>
                  </p>
                  {sendMemo.trim() && (
                    <p className="mt-2">
                      <span className="text-dim">Memo</span> {sendMemo.trim()}
                    </p>
                  )}
                  <p className="mt-3 text-[0.65rem] text-amber-200/80">
                    Leaves this device’s light wallet. No recovery if wrong.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void confirmSend()}
                  className="w-full rounded-xl bg-[var(--btn-primary-bg)] py-2.5 text-sm font-semibold text-[var(--btn-primary-fg)]"
                >
                  Confirm send
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
