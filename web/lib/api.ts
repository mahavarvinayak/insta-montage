export type Status = "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
export interface Post {
  id: string; media_type: "CAROUSEL" | "REEL" | "PHOTO"; caption: string; media_urls: string[];
  scheduled_at: string | null; status: Status; attempts: number; next_attempt_at: string | null;
  instagram_media_id: string | null; permalink: string | null; last_error: string | null;
  published_at: string | null; created_at: string; updated_at: string;
}
export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const body = init.body;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const headers: Record<string, string> = isForm
    ? { ...(init.headers as Record<string, string> | undefined) }
    : isBlob
      ? { "content-type": (body as Blob).type || "application/octet-stream", ...(init.headers as Record<string, string> | undefined) }
      : { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) };

  const res = await fetch(path, { credentials: "same-origin", ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    if (!window.location.pathname.startsWith("/login")) window.location.href = "/login/";
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

const TZ = "Asia/Kolkata";
export const fmtIST = (iso?: string | null, opts: Intl.DateTimeFormatOptions = {}) => {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, ...opts
    }).format(new Date(ms)) + " IST";
  } catch {
    return "—";
  }
};

/** "2026-11-02" + "09:30" in IST -> UTC ISO */
export const istToUtc = (date: string, time: string) => {
  if (!date || !time) return new Date().toISOString();
  const d = new Date(`${date}T${time}:00+05:30`);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/** UTC ISO -> { date, time } in IST */
export function utcToIst(iso?: string | null) {
  const ms = iso ? Date.parse(iso) : NaN;
  const d = new Date(Number.isFinite(ms) ? ms + 5.5 * 3600_000 : Date.now() + 5.5 * 3600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}
export const isVideo = (url: string) => /\.mp4($|\?)/i.test(url);
