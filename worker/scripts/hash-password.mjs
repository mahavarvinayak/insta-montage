import { webcrypto as c } from "node:crypto";
const pw = process.argv[2]; if (!pw) { console.error("usage: npm run hash-password -- 'password'"); process.exit(1); }
const it = 100000, salt = c.getRandomValues(new Uint8Array(16));
const key = await c.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
const bits = await c.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: it }, key, 256);
const b64 = (u) => Buffer.from(u).toString("base64");
console.log(`pbkdf2$${it}$${b64(salt)}$${b64(new Uint8Array(bits))}`);
