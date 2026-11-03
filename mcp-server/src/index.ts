#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { InstaMontageClient } from "./client.js";
import { scanMediaFolder, uploadLocalMediaFile } from "./tools/media.js";
import { createPostFromParams, batchScheduleFolder, parseScheduleTime } from "./tools/post.js";
import { listQueuePosts, getPostWithLogs, updateExistingPost } from "./tools/manage.js";
import { getAccountAnalytics, getSystemHealth } from "./tools/analytics.js";

const client = new InstaMontageClient();

const server = new McpServer({
  name: "insta-montage-mcp-server",
  version: "1.0.0",
});

// Helper to format responses for MCP
function formatResult(data: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function formatError(err: any) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Error: ${err?.message || String(err)}`,
      },
    ],
  };
}

// ---------------- 1. Media & Local Files Tools ----------------

server.tool(
  "insta_scan_media_folder",
  "Scan a local directory on your machine for images (.jpg, .png, .webp) and videos (.mp4, .mov) ready to be published or scheduled on Instagram. Automatically detects whether items are Photos, Carousels, or Reels, and reads any companion caption files (.txt or .md).",
  {
    folder_path: z.string().describe("Absolute or relative path to the local directory containing media files (e.g. 'C:/Users/name/Desktop/posts')"),
    mode: z.enum(["each_file_as_post", "subfolders_as_carousels"]).default("each_file_as_post")
      .describe("'each_file_as_post': each image/video file is an individual post. 'subfolders_as_carousels': each subfolder is treated as 1 carousel post containing multiple images."),
  },
  async ({ folder_path, mode }) => {
    try {
      const candidates = await scanMediaFolder(folder_path, mode);
      return formatResult({
        folder: folder_path,
        mode,
        foundPosts: candidates.length,
        candidates: candidates.map(c => ({
          type: c.type,
          name: c.name,
          filesCount: c.fileCount,
          files: c.files,
          hasCaptionFile: !!c.caption,
          captionPreview: c.caption ? (c.caption.length > 80 ? c.caption.slice(0, 80) + "..." : c.caption) : "No caption file found",
        })),
      });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_upload_media",
  "Upload a single local image or video file to Insta Montage Cloudflare KV storage. For images, automatically verifies Instagram aspect ratios (4:5 to 1.91:1), downscales oversized 4K/300DPI images to standard 1080x1350, and converts to high-quality JPEG so Instagram never rejects it.",
  {
    file_path: z.string().describe("Path to local image (.jpg, .png, .webp) or video (.mp4, .mov) file"),
  },
  async ({ file_path }) => {
    try {
      const result = await uploadLocalMediaFile(client, file_path);
      return formatResult(result);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

// ---------------- 2. Post Creation & Batch Scheduling ----------------

server.tool(
  "insta_create_post",
  "Create and schedule (or immediately publish) a single Photo, Carousel, or Reel post on Instagram. Can take local file paths directly (will auto-optimize and upload them) or existing /media/ URLs.",
  {
    local_files: z.array(z.string()).optional().describe("Array of local file paths (e.g. ['C:/images/slide1.png', 'C:/images/slide2.png']). They will be auto-optimized and uploaded."),
    media_urls: z.array(z.string()).optional().describe("Array of already uploaded '/media/<key>' URLs if not using local_files"),
    media_type: z.enum(["PHOTO", "CAROUSEL", "REEL"]).optional().describe("Type of post. If omitted, auto-detected (1 image = PHOTO, multiple images = CAROUSEL, video = REEL)"),
    caption: z.string().default("").describe("Caption text for the post, including hashtags and emojis"),
    scheduled_at: z.string().optional().describe("When to publish (e.g. 'tomorrow 10:00', '2026-11-04 18:30', or ISO format). If omitted and publish_now is false, saved as draft."),
    publish_now: z.boolean().default(false).describe("If true, triggers immediate publishing on next tick without scheduling for future"),
  },
  async (params) => {
    try {
      const post = await createPostFromParams(client, params);
      return formatResult({
        success: true,
        post: {
          id: post.id,
          media_type: post.media_type,
          status: post.status,
          scheduled_at: post.scheduled_at,
          caption: post.caption,
          media_urls: post.media_urls,
        },
        message: params.publish_now
          ? "Post queued for immediate publishing!"
          : post.scheduled_at
          ? `Post scheduled successfully for ${post.scheduled_at}`
          : "Post saved as draft",
      });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_batch_schedule_folder",
  "The 1-click batch scheduler! Point to a local folder with images/videos, and it automatically optimizes, uploads, and schedules all of them across multiple dates/times in a single command. Supports automatic caption extraction from companion .txt files.",
  {
    folder_path: z.string().describe("Path to local folder containing the images/videos to schedule"),
    mode: z.enum(["each_file_as_post", "subfolders_as_carousels"]).default("each_file_as_post")
      .describe("'each_file_as_post': each file is scheduled as a separate post. 'subfolders_as_carousels': each subfolder (e.g. post1/, post2/) is a carousel post."),
    start_date_time: z.string().default("tomorrow 10:00")
      .describe("Date and time for the first post to be published (e.g. 'tomorrow 10:00', '2026-11-04 11:00', or ISO string)"),
    interval_hours: z.number().optional().describe("Hours between each consecutive post (e.g. 4 for every 4 hours, 24 for once daily). Default: 4 hours."),
    daily_times: z.array(z.string()).optional()
      .describe("Optional daily schedule slots (e.g. ['10:00', '14:00', '18:00', '21:00']). If provided, distributes posts across these slots day by day."),
    default_caption: z.string().optional().describe("Fallback caption if a post doesn't have a matching .txt or .md caption file"),
  },
  async (params) => {
    try {
      const result = await batchScheduleFolder(client, params);
      return formatResult(result);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

// ---------------- 3. Queue & Post Management Tools ----------------

server.tool(
  "insta_list_posts",
  "List posts in Insta Montage queue filtered by status (all, scheduled, published, failed, draft).",
  {
    status: z.enum(["all", "scheduled", "published", "failed", "draft"]).default("all")
      .describe("Filter by post status"),
    limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of posts to return"),
  },
  async ({ status, limit }) => {
    try {
      const result = await listQueuePosts(client, status, limit);
      return formatResult(result);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_get_post_details",
  "Get full details and execution publish logs for a specific post by ID. Shows attempt count, error messages, and Instagram permalink.",
  {
    post_id: z.string().describe("UUID of the post"),
  },
  async ({ post_id }) => {
    try {
      const result = await getPostWithLogs(client, post_id);
      return formatResult(result);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_publish_now",
  "Force an existing scheduled or draft post to publish immediately.",
  {
    post_id: z.string().describe("UUID of the post to publish immediately"),
  },
  async ({ post_id }) => {
    try {
      const result = await client.publishNow(post_id);
      return formatResult({ success: true, result, message: "Post queued for immediate publishing!" });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_retry_post",
  "Retry a post that previously failed publishing.",
  {
    post_id: z.string().describe("UUID of the failed post"),
  },
  async ({ post_id }) => {
    try {
      const result = await client.retryPost(post_id);
      return formatResult({ success: true, result, message: "Post reset to scheduled and queued for retry!" });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_cancel_post",
  "Cancel a scheduled post and automatically delete its uploaded media from Cloudflare KV storage to free up space.",
  {
    post_id: z.string().describe("UUID of the post to cancel"),
  },
  async ({ post_id }) => {
    try {
      const result = await client.cancelPost(post_id);
      return formatResult({ success: true, result, message: "Post cancelled and media storage cleaned up." });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_update_post",
  "Update an existing post's caption, scheduled publishing time, or media.",
  {
    post_id: z.string().describe("UUID of the post to update"),
    caption: z.string().optional().describe("New caption text"),
    scheduled_at: z.string().optional().describe("New scheduled publishing time (e.g. 'tomorrow 12:00' or ISO string)"),
    media_type: z.enum(["PHOTO", "CAROUSEL", "REEL"]).optional().describe("Change media type"),
  },
  async ({ post_id, caption, scheduled_at, media_type }) => {
    try {
      const result = await updateExistingPost(client, post_id, { caption, scheduled_at, media_type });
      return formatResult({ success: true, post: result, message: "Post updated successfully!" });
    } catch (err: any) {
      return formatError(err);
    }
  }
);

// ---------------- 4. Analytics & Health Tools ----------------

server.tool(
  "insta_get_analytics",
  "Fetch live Instagram performance analytics: followers count, engagement rate, average likes and comments per post, and performance breakdown of top recent posts.",
  {},
  async () => {
    try {
      const analytics = await getAccountAnalytics(client);
      return formatResult(analytics);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

server.tool(
  "insta_get_status",
  "Check system health: Meta Instagram API token validity and expiry, connected Instagram username (@aibyvins), permissions, and scheduled queue counts.",
  {},
  async () => {
    try {
      const health = await getSystemHealth(client);
      return formatResult(health);
    } catch (err: any) {
      return formatError(err);
    }
  }
);

// ---------------- Start Server ----------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Insta Montage MCP Server connected to stdio transport");
}

main().catch((err) => {
  console.error("Fatal error starting Insta Montage MCP server:", err);
  process.exit(1);
});

