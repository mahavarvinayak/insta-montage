import { type Env, type PostRow, nowIso } from "./env";
import { IgError, publishCarousel, publishReel } from "./instagram";
import { notify } from "./telegram";

const maxAttempts = (env: Env) => Math.max(1, Number(env.MAX_ATTEMPTS || 5) || 5);

const baseUrl = (env: Env) => (env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

/** PUBLIC_BASE_URL must be the real HTTPS origin Instagram can reach. */
export function baseUrlOk(env: Env) {
  const b = baseUrl(env);
  return /^https:\/\//i.test(b) && !/YOUR-SUBDOMAIN|example\.com/i.test(b);
}

/** R2 keys are stored as relative "/media/<key>" paths; Instagram needs an absolute URL. */
export function absoluteMediaUrl(env: Env, url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl(env)}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function log(env: Env, postId: string, level: "info" | "error", message: string) {
  await env.DB.prepare("INSERT INTO publish_logs (post_id, level, message, created_at) VALUES (?,?,?,?)")
    .bind(postId, level, message.slice(0, 2000), nowIso()).run();
}

/** Atomically claim a post. Only one caller can win. */
export async function claim(env: Env, id: string, allowed: string[]): Promise<PostRow | null> {
  const ph = allowed.map(() => "?").join(",");
  const now = nowIso();
  return env.DB.prepare(
    `UPDATE posts SET status='publishing', attempts=attempts+1, updated_at=? WHERE id=? AND status IN (${ph}) RETURNING *`
  ).bind(now, id, ...allowed).first<PostRow>();
}

export async function runPublish(env: Env, post: PostRow) {
  let raw: string[] = [];
  try { raw = JSON.parse(post.media_urls); } catch { raw = []; }
  const l = (m: string) => log(env, post.id, "info", m);
  await l(`Attempt ${post.attempts} started`);
  try {
    if (!raw.length) throw new IgError("No media files found for this post.", false);
    if (raw.some((u) => !/^https?:\/\//i.test(u)) && !baseUrlOk(env))
      throw new IgError(
        "PUBLIC_BASE_URL is not set to this Worker's real https URL, so Instagram cannot fetch the media. Set it in wrangler.toml and redeploy.",
        false
      );
    const urls = raw.map((u) => absoluteMediaUrl(env, u));
    const caption = post.caption || "";
    const res = post.media_type === "CAROUSEL"
      ? await publishCarousel(env, urls, caption, l)
      : await publishReel(env, urls[0], caption, l);
    const now = nowIso();
    await env.DB.prepare(
      "UPDATE posts SET status='published', instagram_media_id=?, permalink=?, published_at=?, last_error=NULL, next_attempt_at=NULL, updated_at=? WHERE id=? AND status='publishing'"
    ).bind(res.mediaId, res.permalink ?? null, now, now, post.id).run();
    await l(`Published ${res.mediaId}${res.permalink ? ` (${res.permalink})` : ""}`);
    await notify(env, `✅ Published ${post.media_type.toLowerCase()} on Instagram\n${res.permalink ?? res.mediaId}`);
    return { ok: true as const, ...res };
  } catch (e: any) {
    const transient = e instanceof IgError ? e.transient : true;
    const msg = e?.message || String(e);
    await log(env, post.id, "error", msg);
    const now = nowIso();
    if (transient && post.attempts < maxAttempts(env)) {
      const backoffMin = 2 ** post.attempts; // 2,4,8,16...
      const next = new Date(Date.now() + backoffMin * 60_000).toISOString();
      await env.DB.prepare("UPDATE posts SET status='scheduled', last_error=?, next_attempt_at=?, updated_at=? WHERE id=?")
        .bind(msg, next, now, post.id).run();
      await l(`Transient failure, retry in ${backoffMin} min`);
      return { ok: false as const, error: msg, willRetry: true };
    }
    await env.DB.prepare("UPDATE posts SET status='failed', last_error=?, next_attempt_at=NULL, updated_at=? WHERE id=?")
      .bind(msg, now, post.id).run();
    const snippet = (post.caption || "").slice(0, 80);
    await notify(env, `❌ Publishing failed (attempt ${post.attempts})${snippet ? `\n${snippet}` : ""}\n\n${msg}`);
    return { ok: false as const, error: msg, willRetry: false };
  }
}

export async function cleanupOldPosts(env: Env) {
  try {
    const hours = Math.max(1, Number(env.RETENTION_HOURS || 48) || 48);
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    const old = await env.DB.prepare(
      `SELECT id, media_urls FROM posts WHERE (status='published' AND published_at <= ?) OR (status='cancelled' AND updated_at <= ?) LIMIT 20`
    ).bind(cutoff, cutoff).all<{ id: string; media_urls: string }>();

    for (const post of old.results) {
      let urls: string[] = [];
      try { urls = JSON.parse(post.media_urls); } catch { urls = []; }
      // Delete media from R2 bucket so storage doesn't accumulate
      await Promise.allSettled(urls.map((u) => {
        const mt = u.match(/\/media\/(.+)$/);
        return mt ? env.MEDIA.delete(decodeURIComponent(mt[1])) : Promise.resolve();
      }));
      // Remove logs and post record
      await env.DB.prepare("DELETE FROM publish_logs WHERE post_id=?").bind(post.id).run();
      await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(post.id).run();
    }
  } catch (e: any) {
    console.error("Auto-cleanup error:", e);
  }
}

export async function scheduledTick(env: Env) {
  const now = nowIso();

  // Automatically delete published posts and R2 media older than 2 days (48h)
  await cleanupOldPosts(env);

  // Recover posts stuck in 'publishing' (worker crashed / hit a runtime limit).
  // 20 minutes is longer than the slowest legitimate Reel (8 min).
  const staleBefore = new Date(Date.now() - 20 * 60_000).toISOString();
  const stale = await env.DB.prepare("SELECT id FROM posts WHERE status='publishing' AND updated_at < ?")
    .bind(staleBefore).all<{ id: string }>();
  for (const { id } of stale.results) {
    await env.DB.prepare(
      "UPDATE posts SET status='scheduled', next_attempt_at=?, last_error=?, updated_at=? WHERE id=? AND status='publishing'"
    ).bind(now, "Publishing was interrupted; requeued automatically.", now, id).run();
    await log(env, id, "info", "Post was stuck in 'publishing' and has been requeued.");
  }

  // One post per tick by default: a 10-image carousel already uses ~30 subrequests
  // and the Workers free plan caps an invocation at 50.
  const batch = Math.min(3, Math.max(1, Number(env.CRON_BATCH || 1) || 1));
  const due = await env.DB.prepare(
    `SELECT id FROM posts WHERE status='scheduled' AND scheduled_at <= ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY scheduled_at LIMIT ?`
  ).bind(now, now, batch).all<{ id: string }>();

  for (const { id } of due.results) {
    const post = await claim(env, id, ["scheduled"]);
    if (!post) continue; // another invocation won the race
    try {
      await runPublish(env, post); // sequential to respect Meta rate limits
    } catch (e: any) {
      await log(env, id, "error", `Scheduler error: ${e?.message || String(e)}`);
    }
  }
}
