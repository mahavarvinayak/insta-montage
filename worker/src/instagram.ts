import type { Env } from "./env";

export class IgError extends Error {
  constructor(message: string, public transient: boolean) { super(message); }
}
export const igConfigured = (env: Env) => !!(env.IG_USER_ID && env.IG_ACCESS_TOKEN);
const base = (env: Env) => {
  const host = (env.IG_GRAPH_HOST || "graph.facebook.com").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const version = (env.IG_API_VERSION || "v23.0").trim().replace(/^\/+|\/+$/g, "");
  return `https://${host}/${version}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Meta error codes that are worth retrying: 1/2 (temporary), 4/17/32/341/613 (rate limit), 9007 (media not ready)
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613, 9007]);

async function call(env: Env, method: "GET" | "POST", path: string, params: Record<string, string> = {}) {
  if (!igConfigured(env)) throw new IgError("Instagram is not configured (IG_USER_ID / IG_ACCESS_TOKEN missing).", false);
  const body = new URLSearchParams({ ...params, access_token: env.IG_ACCESS_TOKEN! });
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  let res: Response;
  try {
    res = method === "GET"
      ? await fetch(`${base(env)}${cleanPath}?${body}`)
      : await fetch(`${base(env)}${cleanPath}`, { method: "POST", body });
  } catch (e: any) { throw new IgError(`Network error: ${e.message}`, true); }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = json.error || {};
    const msg = `Meta API ${res.status}: ${err.message || "unknown error"}${err.code ? ` (code ${err.code}${err.error_subcode ? "/" + err.error_subcode : ""})` : ""}`;
    throw new IgError(msg, res.status >= 500 || res.status === 429 || res.status === 408 || TRANSIENT_CODES.has(err.code) || !!err.is_transient);
  }
  return json;
}

async function waitFinished(env: Env, containerId: string, timeoutMs: number, log: (m: string) => Promise<void>) {
  const start = Date.now(); let delay = 3000;
  while (Date.now() - start < timeoutMs) {
    let s: any;
    try {
      s = await call(env, "GET", `/${containerId}`, { fields: "status_code,status" });
    } catch (err: any) {
      if (err instanceof IgError && err.transient) {
        await log(`Polling container ${containerId} transient glitch: ${err.message}`);
        await sleep(delay);
        delay = Math.min(delay * 1.5, 15000);
        continue;
      }
      throw err;
    }
    if (s.status_code === "FINISHED" || s.status_code === "PUBLISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new IgError(`Container ${containerId} ${s.status_code}: ${s.status || ""}`, false);
    await sleep(delay); delay = Math.min(delay * 1.5, 15000);
  }
  await log(`Container ${containerId} still processing after ${Math.round(timeoutMs / 1000)}s`);
  throw new IgError("Media processing timed out; will retry.", true);
}

async function publishContainer(env: Env, creationId: string) {
  let r: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await call(env, "POST", `/${env.IG_USER_ID}/media_publish`, { creation_id: creationId });
      break;
    } catch (e: any) {
      // 9007: Media not ready yet (internal replica lag right after container FINISHED)
      if (attempt < 2 && e instanceof IgError && e.message.includes("9007")) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  let permalink: string | undefined;
  // permalink is usually available immediately, but can lag a moment behind publishing.
  for (let i = 0; i < 3 && !permalink; i++) {
    if (i) await sleep(1500);
    const info: any = await call(env, "GET", `/${r.id}`, { fields: "permalink" }).catch(() => ({}));
    permalink = info.permalink;
  }
  return { mediaId: r.id as string, permalink };
}

export async function publishCarousel(env: Env, urls: string[], caption: string, log: (m: string) => Promise<void>) {
  if (urls.length < 2 || urls.length > 10) throw new IgError("Carousel needs 2–10 images.", false);
  const children: string[] = [];
  for (const [i, url] of urls.entries()) {
    const c = await call(env, "POST", `/${env.IG_USER_ID}/media`, { image_url: url, is_carousel_item: "true" });
    children.push(c.id); await log(`Child ${i + 1}/${urls.length} container ${c.id}`);
  }
  for (const id of children) await waitFinished(env, id, 120_000, log);
  const params: Record<string, string> = { media_type: "CAROUSEL", children: children.join(",") };
  if (caption && caption.trim()) params.caption = caption;
  const parent = await call(env, "POST", `/${env.IG_USER_ID}/media`, params);
  await log(`Carousel container ${parent.id}`);
  await waitFinished(env, parent.id, 180_000, log);
  return publishContainer(env, parent.id);
}

export async function publishReel(env: Env, videoUrl: string, caption: string, log: (m: string) => Promise<void>) {
  const params: Record<string, string> = { media_type: "REELS", video_url: videoUrl, share_to_feed: "true" };
  if (caption && caption.trim()) params.caption = caption;
  const c = await call(env, "POST", `/${env.IG_USER_ID}/media`, params);
  await log(`Reel container ${c.id}`);
  await waitFinished(env, c.id, 480_000, log);
  return publishContainer(env, c.id);
}

export async function igStatus(env: Env) {
  if (!igConfigured(env)) return { configured: false, ok: false, error: "IG_USER_ID / IG_ACCESS_TOKEN not set." };
  try {
    const me = await call(env, "GET", `/${env.IG_USER_ID}`, { fields: "username,media_count" });
    return { configured: true, ok: true, username: me.username, media_count: me.media_count };
  } catch (e: any) { return { configured: true, ok: false, error: e.message }; }
}
