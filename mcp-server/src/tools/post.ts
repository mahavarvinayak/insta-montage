import { InstaMontageClient, type PostItem } from "../client.js";
import { uploadLocalMediaFile, scanMediaFolder, type ScannedPostCandidate } from "./media.js";

/**
 * Parses user input date string into UTC ISO string.
 * Supports:
 * - ISO string: "2026-11-04T10:00:00.000Z"
 * - Local datetime: "2026-11-04 15:30" (assumed IST UTC+5:30 unless offset provided)
 * - Relative: "tomorrow 10:00", "+2 hours", "today 18:00"
 */
export function parseScheduleTime(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const s = timeStr.trim();

  // Already ISO with Z or offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    return new Date(s).toISOString();
  }

  const now = new Date();

  // Relative: "+X hours" or "+X days"
  const relMatch = s.match(/^\+(\d+)\s*(hour|hr|minute|min|day)s?$/i);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const d = new Date();
    if (unit.startsWith("min")) d.setMinutes(d.getMinutes() + num);
    else if (unit.startsWith("h")) d.setHours(d.getHours() + num);
    else if (unit.startsWith("d")) d.setDate(d.getDate() + num);
    return d.toISOString();
  }

  // "tomorrow HH:MM" or "today HH:MM"
  const dayTimeMatch = s.match(/^(today|tomorrow)\s+(\d{1,2}):(\d{2})$/i);
  if (dayTimeMatch) {
    const isTomorrow = dayTimeMatch[1].toLowerCase() === "tomorrow";
    const hours = parseInt(dayTimeMatch[2], 10);
    const mins = parseInt(dayTimeMatch[3], 10);

    // Current IST offset is +5:30
    const istNow = new Date(Date.now() + 5.5 * 3600_000);
    const targetIst = new Date(Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate() + (isTomorrow ? 1 : 0),
      hours,
      mins,
      0
    ));
    // Convert back from IST to UTC
    return new Date(targetIst.getTime() - 5.5 * 3600_000).toISOString();
  }

  // "YYYY-MM-DD HH:MM" (default to IST UTC+5:30)
  const dtMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss] = dtMatch;
    const targetIst = new Date(Date.UTC(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      parseInt(ss || "0", 10)
    ));
    return new Date(targetIst.getTime() - 5.5 * 3600_000).toISOString();
  }

  // Fallback to Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  throw new Error(`Unable to parse schedule time: "${timeStr}". Use "YYYY-MM-DD HH:MM", "tomorrow 15:00", or ISO format.`);
}

export interface CreatePostParams {
  local_files?: string[];
  media_urls?: string[];
  media_type?: "PHOTO" | "CAROUSEL" | "REEL";
  caption?: string;
  scheduled_at?: string;
  publish_now?: boolean;
}

export async function createPostFromParams(client: InstaMontageClient, params: CreatePostParams): Promise<PostItem> {
  let mediaUrls: string[] = params.media_urls ? [...params.media_urls] : [];

  // Upload any local files
  if (params.local_files && params.local_files.length > 0) {
    for (const file of params.local_files) {
      const uploaded = await uploadLocalMediaFile(client, file);
      mediaUrls.push(uploaded.url);
    }
  }

  if (mediaUrls.length === 0) {
    throw new Error("No media provided. Specify either 'local_files' or 'media_urls'.");
  }

  // Determine media_type automatically if not passed
  let mediaType = params.media_type;
  if (!mediaType) {
    const hasVideo = mediaUrls.some(u => /\.(mp4|mov|m4v)/i.test(u));
    if (hasVideo) {
      mediaType = "REEL";
    } else if (mediaUrls.length > 1) {
      mediaType = "CAROUSEL";
    } else {
      mediaType = "PHOTO";
    }
  }

  const scheduledAt = params.publish_now ? null : parseScheduleTime(params.scheduled_at);
  const status = params.publish_now ? "scheduled" : scheduledAt ? "scheduled" : "draft";

  const post = await client.createPost({
    media_type: mediaType,
    media_urls: mediaUrls,
    caption: params.caption || "",
    scheduled_at: scheduledAt,
    status,
  });

  if (params.publish_now) {
    await client.publishNow(post.id);
  }

  return post;
}

export interface BatchFolderParams {
  folder_path: string;
  mode?: "each_file_as_post" | "subfolders_as_carousels";
  start_date_time?: string;
  interval_hours?: number;
  daily_times?: string[]; // e.g. ["10:00", "14:00", "18:00", "21:00"]
  default_caption?: string;
}

export async function batchScheduleFolder(client: InstaMontageClient, params: BatchFolderParams) {
  const mode = params.mode || "each_file_as_post";
  const candidates = await scanMediaFolder(params.folder_path, mode);

  if (candidates.length === 0) {
    throw new Error(`No media files (images/videos) found in directory: "${params.folder_path}".`);
  }

  const results: Array<{
    postId: string;
    type: string;
    name: string;
    files: string[];
    scheduledAt: string;
    caption: string;
  }> = [];

  // Calculate schedule times
  const scheduledTimes: string[] = [];
  const baseTimeIso = parseScheduleTime(params.start_date_time || "tomorrow 10:00")!;
  let baseMs = new Date(baseTimeIso).getTime();

  if (params.daily_times && params.daily_times.length > 0) {
    // Schedule across multiple time slots per day
    const istStart = new Date(baseMs + 5.5 * 3600_000);
    let dayOffset = 0;
    let slotIdx = 0;

    for (let i = 0; i < candidates.length; i++) {
      const timeStr = params.daily_times[slotIdx];
      const [hh, mm] = timeStr.split(":").map(Number);

      const istDate = new Date(Date.UTC(
        istStart.getUTCFullYear(),
        istStart.getUTCMonth(),
        istStart.getUTCDate() + dayOffset,
        hh,
        mm,
        0
      ));
      const utcDate = new Date(istDate.getTime() - 5.5 * 3600_000);
      scheduledTimes.push(utcDate.toISOString());

      slotIdx++;
      if (slotIdx >= params.daily_times.length) {
        slotIdx = 0;
        dayOffset++;
      }
    }
  } else {
    // Standard interval (default 4 hours or user specified)
    const intervalMs = (params.interval_hours || 4) * 3600_000;
    for (let i = 0; i < candidates.length; i++) {
      scheduledTimes.push(new Date(baseMs + i * intervalMs).toISOString());
    }
  }

  // Upload and schedule each candidate
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const schedTime = scheduledTimes[i];
    const caption = c.caption || params.default_caption || "";

    const mediaUrls: string[] = [];
    for (const f of c.files) {
      const up = await uploadLocalMediaFile(client, f);
      mediaUrls.push(up.url);
    }

    const post = await client.createPost({
      media_type: c.type,
      media_urls: mediaUrls,
      caption,
      scheduled_at: schedTime,
      status: "scheduled",
    });

    results.push({
      postId: post.id,
      type: c.type,
      name: c.name,
      files: c.files,
      scheduledAt: schedTime,
      caption: caption.slice(0, 80),
    });
  }

  return {
    totalScheduled: results.length,
    folder: params.folder_path,
    posts: results,
  };
}
