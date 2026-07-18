/**
 * grid0 Bech32 addresses (HRP `grid0` → `grid01…`) — matches grid CLI.
 * Light-wallet only: identity is 32 random bytes hashed to 20-byte payload.
 */

const HRP = "grid0";
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i]!;
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const p = polymod(values) ^ 1;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push((p >> (5 * (5 - i))) & 31);
  return out;
}

function convertBits(
  data: number[],
  from: number,
  to: number,
  pad: boolean,
): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
  return ret;
}

async function hash20(pubkey32: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const domain = enc.encode("GRID0-ADDR-v0");
  const buf = new Uint8Array(domain.length + pubkey32.length);
  buf.set(domain, 0);
  buf.set(pubkey32, domain.length);
  // BLAKE3 not in browsers everywhere — use SHA-256 then take 20 (light wallet).
  // CLI uses BLAKE3; light wallet addresses are device-local / disposable.
  const dig = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return dig.slice(0, 20);
}

export async function encodeGrid0(pubkey32: Uint8Array): Promise<string> {
  if (pubkey32.length !== 32) throw new Error("pubkey must be 32 bytes");
  const h20 = await hash20(pubkey32);
  const data = [0, ...convertBits([...h20], 8, 5, true)];
  const checksum = createChecksum(HRP, data);
  let out = HRP + "1";
  for (const d of data.concat(checksum)) out += CHARSET[d]!;
  return out;
}

export function isGrid0Address(addr: string): boolean {
  const s = addr.trim().toLowerCase();
  if (!s.startsWith("grid01") || s.length < 14) return false;
  const pos = s.lastIndexOf("1");
  if (pos < 1) return false;
  const hrp = s.slice(0, pos);
  if (hrp !== HRP) return false;
  const dataPart = s.slice(pos + 1);
  const data: number[] = [];
  for (const c of dataPart) {
    const v = CHARSET.indexOf(c);
    if (v < 0) return false;
    data.push(v);
  }
  if (data.length < 6) return false;
  const values = hrpExpand(hrp).concat(data);
  return polymod(values) === 1;
}

export function randomKey32(): Uint8Array {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
}

export function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(h: string): Uint8Array {
  const clean = h.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
