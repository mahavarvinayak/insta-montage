import type { Env } from "./env";
const enc = new TextEncoder();
const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: ArrayBuffer) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function timingSafe(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0;
}

export async function verifyPassword(pw: string, stored: string) {
  try {
    const [alg, it, salt, hash] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations: Number(it) }, key, 256);
    return timingSafe(new Uint8Array(bits), fromB64(hash));
  } catch { return false; }
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

const COOKIE = "aiv_session";
const TTL = 60 * 60 * 24 * 14;

export async function createSessionCookie(env: Env, email: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${btoa(email)}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET!, payload);
  return `${COOKIE}=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL}`;
}
export const clearCookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export async function isAuthed(req: Request, env: Env) {
  try {
    if (!env.SESSION_SECRET || !env.ADMIN_EMAIL) return false;
    const m = (req.headers.get("cookie") || "").match(new RegExp(`${COOKIE}=([^;]+)`));
    if (!m) return false;
    const [e, exp, sig] = m[1].split(".");
    if (!e || !exp || !sig) return false;
    if (Number(exp) < Date.now() / 1000) return false;
    const expect = await hmac(env.SESSION_SECRET, `${e}.${exp}`);
    if (!timingSafe(enc.encode(expect), enc.encode(sig))) return false;
    return atob(e).toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
  } catch { return false; }
}
