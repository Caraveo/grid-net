/**
 * MESH light wallet — disposable, passkey-gated.
 *
 * Storage (via Tauri when available):
 * - macOS: iCloud Drive / MESH/light-wallet.json (when iCloud Drive exists)
 * - Linux / Windows: local data dir (path shown in UI)
 * - Vite-only fallback: localStorage
 */

import { invoke } from "@tauri-apps/api/core";
import {
  bytesToHex,
  encodeGrid0,
  hexToBytes,
  isGrid0Address,
  randomKey32,
} from "./grid0";

const STORAGE_KEY = "mesh-light-wallet-v1";
const RP_NAME = "MESH Light Wallet";
const RP_ID =
  typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";

export type LightWalletStore = {
  version: 1;
  passkeyCredId: string;
  keyHex: string;
  address: string;
  balance: number;
  createdAt: string;
  txs: LightTx[];
};

export type LightTx = {
  id: string;
  kind: "send" | "receive" | "demo";
  at: string;
  amount: number;
  counterparty?: string;
  memo?: string;
};

export type SessionWallet = LightWalletStore & { unlocked: true };

export type LightWalletInfo = {
  platform: string;
  storageKind: string;
  storageLabel: string;
  directory: string;
  filePath: string;
  exists: boolean;
  icloud: boolean;
};

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(s: string): ArrayBuffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function tryInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export async function getWalletInfo(): Promise<LightWalletInfo> {
  const info = await tryInvoke<LightWalletInfo>("light_wallet_info");
  if (info) return info;
  return {
    platform: "web",
    storageKind: "local",
    storageLabel: "Browser storage (dev)",
    directory: "localStorage",
    filePath: "localStorage:" + STORAGE_KEY,
    exists: !!localStorage.getItem(STORAGE_KEY),
    icloud: false,
  };
}

export async function revealWalletDirectory(): Promise<string | null> {
  return tryInvoke<string>("light_wallet_reveal");
}

function parseStore(raw: string): LightWalletStore | null {
  try {
    const s = JSON.parse(raw) as LightWalletStore;
    if (s.version !== 1 || !s.address || !s.keyHex) return null;
    return s;
  } catch {
    return null;
  }
}

export async function loadStore(): Promise<LightWalletStore | null> {
  const raw = await tryInvoke<string | null>("light_wallet_load");
  if (raw) {
    const s = parseStore(raw);
    if (s) return s;
  }
  // migrate / fallback localStorage
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (!legacy) return null;
    const s = parseStore(legacy);
    if (s) {
      // best-effort promote to native store
      await saveStore(s);
      return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function saveStore(s: LightWalletStore): Promise<void> {
  const json = JSON.stringify(s, null, 2);
  const ok = await tryInvoke<LightWalletInfo>("light_wallet_save", { json });
  if (!ok) {
    localStorage.setItem(STORAGE_KEY, json);
  } else {
    // clear legacy browser copy once native save works
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function formatGrid(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export async function createLightWallet(): Promise<SessionWallet> {
  if (!window.PublicKeyCredential) {
    throw new Error("Passkey not supported in this browser");
  }
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: RP_NAME,
        id: RP_ID === "tauri.localhost" ? "localhost" : RP_ID,
      },
      user: {
        id: userId,
        name: "mesh-light-wallet",
        displayName: "MESH Light Wallet",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Passkey registration cancelled");

  const key = randomKey32();
  const address = await encodeGrid0(key);
  const store: LightWalletStore = {
    version: 1,
    passkeyCredId: b64url(cred.rawId),
    keyHex: bytesToHex(key),
    address,
    balance: 0,
    createdAt: new Date().toISOString(),
    txs: [],
  };
  await saveStore(store);
  return { ...store, unlocked: true };
}

export async function unlockLightWallet(): Promise<SessionWallet> {
  const store = await loadStore();
  if (!store) throw new Error("no light wallet — create one");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: RP_ID === "tauri.localhost" ? "localhost" : RP_ID,
      allowCredentials: [
        {
          type: "public-key",
          id: b64urlToBuf(store.passkeyCredId),
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!assertion) throw new Error("Passkey cancelled");
  return { ...store, unlocked: true };
}

export async function wipeLightWallet(): Promise<void> {
  const ok = await tryInvoke<LightWalletInfo>("light_wallet_wipe");
  if (!ok) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function applySend(
  session: SessionWallet,
  to: string,
  amount: number,
  memo?: string,
): Promise<SessionWallet> {
  if (!isGrid0Address(to)) throw new Error("Invalid grid0 address");
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new Error("Amount must be positive");
  }
  if (amount > session.balance + 1e-12) {
    throw new Error("Insufficient GRID on this device");
  }
  if (to.toLowerCase() === session.address.toLowerCase()) {
    throw new Error("Cannot send to yourself");
  }

  const tx: LightTx = {
    id: `send_${crypto.randomUUID().slice(0, 8)}`,
    kind: "send",
    at: new Date().toISOString(),
    amount,
    counterparty: to.toLowerCase(),
    memo,
  };
  const next: LightWalletStore = {
    ...session,
    balance: session.balance - amount,
    txs: [...session.txs, tx].slice(-200),
  };
  await saveStore(next);
  return { ...next, unlocked: true };
}

export async function demoCredit(
  session: SessionWallet,
  amount = 12.5,
): Promise<SessionWallet> {
  const tx: LightTx = {
    id: `demo_${crypto.randomUUID().slice(0, 8)}`,
    kind: "demo",
    at: new Date().toISOString(),
    amount,
    memo: "demo credit · this device only",
  };
  const next: LightWalletStore = {
    ...session,
    balance: session.balance + amount,
    txs: [...session.txs, tx].slice(-200),
  };
  await saveStore(next);
  return { ...next, unlocked: true };
}

export { isGrid0Address, hexToBytes };
