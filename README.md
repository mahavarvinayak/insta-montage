# Insta Montage

Private, self-hosted dashboard that schedules and auto-publishes Instagram carousels & Reels through the **official Meta Instagram API**. One Cloudflare Worker serves the dashboard (Next.js static export), the API, R2 media, and the every-minute cron — so your laptop can stay off.

```
web/         Next.js 14 + TypeScript + Tailwind dashboard (static export -> web/out)
worker/      Cloudflare Worker: API, auth, KV, D1, cron scheduler, Meta + Telegram services
mcp-server/  Model Context Protocol (MCP) server for Claude, Cursor & IDE AI Agents
```

## 🤖 MCP Server (AI Agent Integration)
Control your entire Instagram pipeline through Claude Desktop, Cursor, or any MCP-compatible AI:
- **1-Click Folder Automation**: Point an AI to a local folder — it auto-optimizes images, uploads them, and schedules all posts.
- **Queue & Post Management**: Create, edit, retry, or cancel posts directly via prompts.
- **Live Analytics**: Fetch follower counts, engagement rate, and post performance.

👉 **[View MCP Setup Guide](mcp-server/README.md)**


## 1. Prerequisites
- Node 20+, a Cloudflare account, `npm i -g wrangler` and `wrangler login`
- An Instagram **professional** account with a long-lived token
  - Instagram API with Instagram Login: scopes `instagram_business_basic`, `instagram_business_content_publish`
  - or Facebook Login: `instagram_basic`, `instagram_content_publish`, `pages_show_list` — then set `IG_GRAPH_HOST=graph.facebook.com`
- Optional: a Telegram bot (via @BotFather) plus your chat id

## 2. Create resources
```bash
cd worker && npm install
wrangler d1 create insta-montage-db          # paste database_id into wrangler.toml
wrangler r2 bucket create insta-montage-media
npm run db:migrate:remote                    # applies 0001_init + 0002_auth_throttle
```

## 3. Secrets (never in code)
```bash
wrangler secret put ADMIN_EMAIL
npm run hash-password -- 'your-strong-password'   # prints PBKDF2 hash
wrangler secret put ADMIN_PASSWORD_HASH
wrangler secret put SESSION_SECRET        # any long random string
wrangler secret put IG_USER_ID
wrangler secret put IG_ACCESS_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN    # optional
wrangler secret put TELEGRAM_CHAT_ID      # optional
```
Set `PUBLIC_BASE_URL` in `wrangler.toml` to your Worker's HTTPS URL (e.g. `https://insta-montage.<you>.workers.dev`).
Instagram downloads media from `PUBLIC_BASE_URL/media/<key>` — it must be publicly reachable over HTTPS.

## 4. Deploy
```bash
cd web && npm install && npm run build      # -> web/out
cd ../worker && npm run deploy              # Worker + assets + cron (* * * * *)
```

## Local development
```bash
cp worker/.dev.vars.example worker/.dev.vars   # fill in values
cd worker && npm run db:migrate:local && npm run dev   # http://localhost:8787
cd web && npm run dev                                  # http://localhost:3000 (proxies /api and /media to 8787)
```
Uploaded media is stored as a relative `/media/<key>` path, so previews work on localhost. Instagram still has to download from a public URL, so **real publishing only works once deployed** (or behind a tunnel, with `PUBLIC_BASE_URL` updated).

The scheduler is a cron trigger, so "Publish now" is queued and picked up within a minute. Locally, trigger it yourself:
```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## How publishing works
- Times are stored in UTC, shown/entered in Asia/Kolkata.
- Cron each minute atomically claims due posts (`UPDATE ... WHERE status='scheduled' ... RETURNING`), so a post is never published twice.
- Carousel: child JPEG containers -> carousel container -> wait `FINISHED` -> `media_publish` -> permalink.
- Reel: `REELS` container -> wait `FINISHED` (up to ~8 min) -> `media_publish`.
- Transient errors (network, 5xx, 429, rate limit, processing timeout) retry with backoff 2, 4, 8, 16 min up to `MAX_ATTEMPTS`; other errors fail permanently. Every step is logged in `publish_logs`; Telegram notifies success/failure.
- `POST /api/posts/:id/publish` and `/retry` only **queue** the post (HTTP 202). Publishing runs inside the cron invocation, never in a browser request, because Reels can take minutes and Cloudflare cuts long requests off at ~100 s.
- Posts stuck in `publishing` for more than 20 minutes (worker crash) are requeued automatically.

## Limits worth knowing
| Thing | Limit | Why |
| --- | --- | --- |
| Carousel images | 2–10, JPEG, max 8 MB | Instagram API accepts JPEG only; PNG/WebP are converted in the browser |
| Reel video | 1 MP4, 3 s–15 min, max 90 MB | Cloudflare caps Worker request bodies at 100 MB (Free) |
| Posts per cron tick | `CRON_BATCH`, default 1 | A 10-image carousel uses ~30 subrequests; Free plan allows 50 per invocation |
| Instagram publishing | ~25–50 posts / 24 h per account | Meta platform limit |
| Access token | ~60 days for long-lived tokens | refresh with `wrangler secret put IG_ACCESS_TOKEN` |

## File map
```
web/app/          pages: overview, queue, create, published, failed, settings, login
web/components/   shell (sidebar), post row, UI primitives
web/lib/api.ts    fetch wrapper + IST <-> UTC helpers
worker/src/       index.ts (routes), publisher.ts (claim/retry/cron), instagram.ts, auth.ts, telegram.ts
worker/migrations D1 schema (posts, publish_logs, auth_attempts)
```

## Troubleshooting
- **`code 190` / "Session has expired"** — long-lived token expired; refresh `IG_ACCESS_TOKEN`.
- **`PUBLIC_BASE_URL is not set ...`** — set it to the real `https://…workers.dev` URL and redeploy.
- **`Media processing timed out`** — Meta is slow; the post retries automatically with backoff.
- **`code 9007` / media not ready** — treated as transient and retried.
- **401 everywhere** — the session cookie expired; sign in again. After 8 bad passwords an IP is locked out for 15 minutes (`auth_attempts` table).
