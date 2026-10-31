export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  PUBLIC_BASE_URL: string;
  IG_GRAPH_HOST: string;
  IG_API_VERSION: string;
  MAX_ATTEMPTS: string;
  CRON_BATCH?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
  IG_USER_ID?: string;
  IG_ACCESS_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}
export type Status = "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
export interface PostRow {
  id: string; media_type: "CAROUSEL" | "REEL"; caption: string; media_urls: string;
  scheduled_at: string | null; status: Status; attempts: number; next_attempt_at: string | null;
  instagram_media_id: string | null; permalink: string | null; last_error: string | null;
  published_at: string | null; created_at: string; updated_at: string;
}
export const nowIso = () => new Date().toISOString();
