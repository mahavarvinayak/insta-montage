import { type Env, type PostRow, nowIso } from "./env";
import { clearCookie, createSessionCookie, isAuthed, verifyPassword } from "./auth";
import { scheduledTick } from "./publisher";
import { igConfigured, igStatus } from "./instagram";
import { notify, telegramConfigured } from "./telegram";
import { putMedia as storeMedia, getMediaResponse, deleteMediaFile } from "./storage";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const err = (message: string, status = 400) => json({ error: message }, status);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Instagram content publishing accepts JPEG images and MP4 videos only.
const IMG_TYPE = "image/jpeg";
const VID_TYPE = "video/mp4";
const MAX_IMG_BYTES = 8 * 1024 * 1024;
// Cloudflare caps a Worker request body at 100 MB (Free plan) / 500 MB (Paid).
const MAX_VID_BYTES = 90 * 1024 * 1024;

const LOGIN_MAX = 8;
const LOGIN_WINDOW = 15 * 60_000;

function serialize(p: PostRow) {
  let urls: string[] = [];
  try { urls = JSON.parse(p.media_urls) as string[]; } catch { urls = []; }
  return { ...p, media_urls: urls };
}

/* ---------------- login throttle (D1, fails open if migration is missing) ---------------- */

async function loginState(env: Env, ip: string) {
  try {
    const row = await env.DB.prepare("SELECT count, first_at FROM auth_attempts WHERE ip=?").bind(ip)
      .first<{ count: number; first_at: string }>();
    if (!row) return { blocked: false };
    const age = Date.now() - Date.parse(row.first_at);
    if (!Number.isFinite(age) || age > LOGIN_WINDOW) {
      await env.DB.prepare("DELETE FROM auth_attempts WHERE ip=?").bind(ip).run();
      return { blocked: false };
    }
    return { blocked: row.count >= LOGIN_MAX, retryAfter: Math.max(1, Math.ceil((LOGIN_WINDOW - age) / 1000)) };
  } catch { return { blocked: false }; }
}

async function recordLoginFailure(env: Env, ip: string) {
  try {
    const row = await env.DB.prepare("SELECT count, first_at FROM auth_attempts WHERE ip=?").bind(ip)
      .first<{ count: number; first_at: string }>();
    const age = row ? Date.now() - Date.parse(row.first_at) : Infinity;
    if (!row || !Number.isFinite(age) || age > LOGIN_WINDOW)
      await env.DB.prepare("INSERT INTO auth_attempts (ip, count, first_at) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=1, first_at=excluded.first_at")
        .bind(ip, nowIso()).run();
    else
      await env.DB.prepare("UPDATE auth_attempts SET count=count+1 WHERE ip=?").bind(ip).run();
  } catch { /* throttle is best-effort */ }
}

async function clearLoginFailures(env: Env, ip: string) {
  try { await env.DB.prepare("DELETE FROM auth_attempts WHERE ip=?").bind(ip).run(); } catch { /* ignore */ }
}

/* ---------------- validation ---------------- */

function validate(body: any, requireSchedule: boolean): string | null {
  if (!["CAROUSEL", "REEL"].includes(body.media_type)) return "media_type must be CAROUSEL or REEL";
  const urls = body.media_urls;
  if (!Array.isArray(urls)) return "media_urls must be an array";
  if (!urls.every((u: unknown) => typeof u === "string" && /^\/media\/.+|^https?:\/\//.test(u)))
    return "media_urls must be '/media/<key>' paths or https URLs";
  if (body.media_type === "CAROUSEL" && (urls.length < 2 || urls.length > 10)) return "Carousel needs 2–10 images";
  if (body.media_type === "REEL" && urls.length !== 1) return "Reel needs exactly 1 video";
  if (typeof body.caption === "string" && body.caption.length > 2200) return "Caption exceeds 2200 characters";
  if (((body.caption || "").match(/#\w+/g) || []).length > 30) return "Instagram allows max 30 hashtags";
  if (body.scheduled_at && isNaN(Date.parse(body.scheduled_at))) return "Invalid scheduled_at date format";
  if (requireSchedule) {
    if (!body.scheduled_at || isNaN(Date.parse(body.scheduled_at))) return "A valid scheduled_at is required";
    if (Date.parse(body.scheduled_at) < Date.now() - 60_000) return "Scheduled time is in the past";
  }
  return null;
}

/* ---------------- uploads ---------------- */

async function upload(req: Request, env: Env): Promise<Response> {
  let ct = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (ct === "image/jpg") ct = IMG_TYPE;

  // Legacy multipart form (buffered — only suitable for small files).
  if (ct === "multipart/form-data") {
    const form = await req.formData();
    const file = form.get("file") as unknown as File | null;
    if (!file || typeof file === "string") return err("file is required");
    let type = (file.type || "").toLowerCase();
    if (type === "image/jpg") type = IMG_TYPE;
    if (type !== IMG_TYPE && type !== VID_TYPE) return err("Only JPEG images or MP4 videos are allowed");
    const limit = type === IMG_TYPE ? MAX_IMG_BYTES : MAX_VID_BYTES;
    if (file.size > limit) return err(`File is too large (${(file.size / 1048576).toFixed(1)} MB). Max ${limit / 1048576} MB.`, 413);
    const res = await storeMedia(env, type, file.size, file);
    return json(res);
  }

  // Raw body stream
  if (ct !== IMG_TYPE && ct !== VID_TYPE) return err("Only JPEG images or MP4 videos are allowed");
  if (!req.body) return err("Empty upload");
  const len = Number(req.headers.get("content-length") || 0);
  const limit = ct === IMG_TYPE ? MAX_IMG_BYTES : MAX_VID_BYTES;
  if (len > limit) return err(`File is too large (${(len / 1048576).toFixed(1)} MB). Max ${limit / 1048576} MB.`, 413);
  const res = await storeMedia(env, ct, len, req.body);
  return json(res);
}

/* ---------------- api ---------------- */

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname; const m = req.method;

  if (path === "/api/health") return json({ ok: true, time: nowIso() });

  if (path === "/api/auth/login" && m === "POST") {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET)
      return err("Admin login is not configured (ADMIN_EMAIL / ADMIN_PASSWORD_HASH / SESSION_SECRET).", 500);
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const gate = await loginState(env, ip);
    if (gate.blocked)
      return json({ error: `Too many failed attempts. Try again in ${Math.ceil((gate.retryAfter || 60) / 60)} min.` }, 429,
        { "retry-after": String(gate.retryAfter || 60) });
    let body: any;
    try { body = await req.json(); } catch { return err("Invalid JSON body"); }
    const ok = String(body?.email || "").toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
      && (await verifyPassword(String(body?.password || ""), env.ADMIN_PASSWORD_HASH));
    if (!ok) { await recordLoginFailure(env, ip); await sleep(600); return err("Invalid email or password", 401); }
    await clearLoginFailures(env, ip);
    return json({ ok: true }, 200, { "set-cookie": await createSessionCookie(env, env.ADMIN_EMAIL) });
  }
  if (path === "/api/auth/logout" && m === "POST") return json({ ok: true }, 200, { "set-cookie": clearCookie });

  if (!(await isAuthed(req, env))) return err("Unauthorized", 401);
  if (path === "/api/auth/me") return json({ ok: true, email: env.ADMIN_EMAIL });

  // ---- uploads (R2) ----
  if (path === "/api/upload" && m === "POST") return upload(req, env);

  // ---- stats ----
  if (path === "/api/stats") {
    // Month boundary in Asia/Kolkata (UTC+5:30), stored as UTC.
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 5.5 * 3600_000).toISOString();
    const [s, p, f, next, act] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) c FROM posts WHERE status='scheduled'").first<{ c: number }>(),
      env.DB.prepare("SELECT COUNT(*) c FROM posts WHERE status='published' AND published_at >= ?").bind(monthStart).first<{ c: number }>(),
      env.DB.prepare("SELECT COUNT(*) c FROM posts WHERE status='failed'").first<{ c: number }>(),
      env.DB.prepare("SELECT * FROM posts WHERE status='scheduled' ORDER BY scheduled_at LIMIT 1").first<PostRow>(),
      env.DB.prepare("SELECT l.*, COALESCE(p.media_type, 'POST') as media_type, COALESCE(p.caption, '') as caption FROM publish_logs l LEFT JOIN posts p ON p.id=l.post_id ORDER BY l.id DESC LIMIT 12").all(),
    ]);
    return json({ scheduled: s?.c ?? 0, publishedThisMonth: p?.c ?? 0, failed: f?.c ?? 0, next: next ? serialize(next) : null, activity: act.results });
  }

  // ---- settings / status ----
  if (path === "/api/instagram/status") return json(await igStatus(env));
  if (path === "/api/config") return json({
    instagram: igConfigured(env), telegram: telegramConfigured(env),
    d1: !!env.DB, storage: !!env.MEDIA_KV, publicBaseUrl: env.PUBLIC_BASE_URL,
    publicBaseUrlOk: /^https:\/\//.test(env.PUBLIC_BASE_URL || "") && !/YOUR-SUBDOMAIN/.test(env.PUBLIC_BASE_URL || ""),
    graphHost: env.IG_GRAPH_HOST, apiVersion: env.IG_API_VERSION || "v23.0",
    maxAttempts: Number(env.MAX_ATTEMPTS || 5), cronBatch: Number(env.CRON_BATCH || 1),
    retentionHours: Number(env.RETENTION_HOURS || 48),
    uploadLimitMb: { image: MAX_IMG_BYTES / 1048576, video: MAX_VID_BYTES / 1048576 },
  });
  if (path === "/api/telegram/test" && m === "POST") {
    const r = await notify(env, "🔔 Test notification from Insta Montage");
    return r.ok ? json(r) : err(r.error!, 400);
  }

  // ---- posts ----
  if (path === "/api/posts" && m === "GET") {
    const status = url.searchParams.get("status");
    const q = status && status !== "all"
      ? (status === "published"
          ? env.DB.prepare("SELECT * FROM posts WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC")
          : env.DB.prepare("SELECT * FROM posts WHERE status=? ORDER BY COALESCE(scheduled_at, created_at) ASC").bind(status))
      : env.DB.prepare("SELECT * FROM posts WHERE status!='cancelled' ORDER BY COALESCE(scheduled_at, created_at) ASC");
    const r = await q.all<PostRow>();
    const rows = r.results.map(serialize);
    return json(rows);
  }
  if (path === "/api/posts" && m === "POST") {
    const b = await req.json<any>();
    const status = b.status === "scheduled" ? "scheduled" : "draft";
    const v = validate(b, status === "scheduled"); if (v) return err(v);
    const id = crypto.randomUUID(), now = nowIso();
    await env.DB.prepare(
      "INSERT INTO posts (id, media_type, caption, media_urls, scheduled_at, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(id, b.media_type, b.caption || "", JSON.stringify(b.media_urls), b.scheduled_at || null, status, now, now).run();
    return json(serialize((await env.DB.prepare("SELECT * FROM posts WHERE id=?").bind(id).first<PostRow>())!), 201);
  }

  const pm = path.match(/^\/api\/posts\/([\w-]+)(?:\/(publish|retry|logs))?$/);
  if (pm) {
    const [, id, action] = pm;
    const post = await env.DB.prepare("SELECT * FROM posts WHERE id=?").bind(id).first<PostRow>();
    if (!post) return err("Post not found", 404);

    if (!action && m === "GET") return json(serialize(post));
    if (action === "logs") return json((await env.DB.prepare("SELECT * FROM publish_logs WHERE post_id=? ORDER BY id DESC LIMIT 50").bind(id).all()).results);

    if (!action && m === "PATCH") {
      if (post.status === "publishing" || post.status === "published") return err(`Cannot edit a ${post.status} post`, 409);
      const b = await req.json<any>();
      let existingUrls: string[] = [];
      try { existingUrls = JSON.parse(post.media_urls); } catch { existingUrls = []; }
      const merged = { media_type: b.media_type ?? post.media_type, caption: b.caption ?? post.caption,
        media_urls: b.media_urls ?? existingUrls, scheduled_at: b.scheduled_at !== undefined ? b.scheduled_at : post.scheduled_at,
        status: b.status ?? post.status };
      if (!["draft", "scheduled", "cancelled"].includes(merged.status)) return err("Invalid status");
      if (merged.status !== "cancelled") { const v = validate(merged, merged.status === "scheduled"); if (v) return err(v); }
      const resetAttempts = merged.status === "scheduled" && (post.status === "failed" || post.attempts > 0);
      await env.DB.prepare(
        `UPDATE posts SET media_type=?, caption=?, media_urls=?, scheduled_at=?, status=?, next_attempt_at=NULL, last_error=CASE WHEN ? THEN NULL ELSE last_error END,
         attempts=CASE WHEN ? THEN 0 ELSE attempts END, updated_at=? WHERE id=?`
      ).bind(merged.media_type, merged.caption, JSON.stringify(merged.media_urls), merged.scheduled_at || null, merged.status, resetAttempts ? 1 : 0, resetAttempts ? 1 : 0, nowIso(), id).run();
      return json(serialize((await env.DB.prepare("SELECT * FROM posts WHERE id=?").bind(id).first<PostRow>())!));
    }
    if (!action && m === "DELETE") {
      if (post.status === "publishing") return err("Post is currently publishing", 409);
      if (post.status === "published") return err("Published posts cannot be deleted here", 409);
      let urls: string[] = [];
      try { urls = JSON.parse(post.media_urls); } catch { urls = []; }
      await env.DB.prepare("UPDATE posts SET status='cancelled', updated_at=? WHERE id=?").bind(nowIso(), id).run();
      // Best-effort storage cleanup so cancelled posts don't leak storage.
      await Promise.allSettled(urls.map((u) => {
        const mt = u.match(/\/media\/(.+)$/);
        return mt ? deleteMediaFile(env, decodeURIComponent(mt[1])) : Promise.resolve();
      }));
      return json({ ok: true });
    }

    // Publishing happens in the cron worker, never inside this request:
    // a Reel can take minutes and Cloudflare returns 524 after ~100s.
    if (action === "publish" && m === "POST") {
      if (!["draft", "scheduled"].includes(post.status)) return err(`Cannot publish from status '${post.status}'`, 409);
      const now = nowIso();
      await env.DB.prepare(
        "UPDATE posts SET status='scheduled', scheduled_at=?, next_attempt_at=NULL, updated_at=? WHERE id=? AND status IN ('draft','scheduled')"
      ).bind(now, now, id).run();
      return json({ ok: true, queued: true, id }, 202);
    }
    if (action === "retry" && m === "POST") {
      if (post.status !== "failed") return err(`Only failed posts can be retried (current status '${post.status}')`, 409);
      const now = nowIso();
      await env.DB.prepare(
        "UPDATE posts SET status='scheduled', attempts=0, last_error=NULL, scheduled_at=?, next_attempt_at=NULL, updated_at=? WHERE id=? AND status='failed'"
      ).bind(now, now, id).run();
      return json({ ok: true, queued: true, id }, 202);
    }
  }
  return err("Not found", 404);
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Public media for Instagram to fetch (unguessable UUID keys).
    if (url.pathname.startsWith("/media/") && (req.method === "GET" || req.method === "HEAD")) {
      const key = decodeURIComponent(url.pathname.slice(7));
      if (!key) return new Response("Not found", { status: 404 });
      return getMediaResponse(req, env, key);
    }

    if (url.pathname.startsWith("/api/")) {
      try { return await api(req, env, url); }
      catch (e: any) { console.error(e); return err(e?.message || "Internal error", 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    await scheduledTick(env);
  },
};
