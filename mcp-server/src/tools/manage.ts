import { InstaMontageClient, type PostItem } from "../client.js";
import { parseScheduleTime } from "./post.js";

export async function listQueuePosts(client: InstaMontageClient, status: "all" | "scheduled" | "published" | "failed" | "draft" = "all", limit = 50) {
  const posts = await client.listPosts(status);
  const sliced = posts.slice(0, limit);

  return {
    total: posts.length,
    returned: sliced.length,
    filter: status,
    posts: sliced.map(p => ({
      id: p.id,
      media_type: p.media_type,
      status: p.status,
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      caption_preview: p.caption ? (p.caption.length > 60 ? p.caption.slice(0, 60) + "..." : p.caption) : "",
      media_count: p.media_urls.length,
      permalink: p.permalink,
      last_error: p.last_error,
      attempts: p.attempts,
    })),
  };
}

export async function getPostWithLogs(client: InstaMontageClient, postId: string) {
  const post = await client.getPost(postId);
  const logs = await client.getPostLogs(postId);

  return {
    post,
    logs: logs.map(l => `[${l.created_at}] [${l.level.toUpperCase()}] ${l.message}`),
  };
}

export async function updateExistingPost(
  client: InstaMontageClient,
  postId: string,
  updates: {
    caption?: string;
    scheduled_at?: string;
    media_type?: "PHOTO" | "CAROUSEL" | "REEL";
    media_urls?: string[];
    status?: "draft" | "scheduled" | "cancelled";
  }
) {
  const payload: any = { ...updates };
  if (updates.scheduled_at) {
    payload.scheduled_at = parseScheduleTime(updates.scheduled_at);
  }
  return client.updatePost(postId, payload);
}
