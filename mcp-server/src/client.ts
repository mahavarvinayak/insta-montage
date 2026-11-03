import { getConfig, type AppConfig } from "./config.js";
import type { MediaProcessResult } from "./optimizer.js";

export interface PostItem {
  id: string;
  media_type: "PHOTO" | "CAROUSEL" | "REEL";
  caption: string;
  media_urls: string[];
  scheduled_at: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  attempts: number;
  instagram_media_id: string | null;
  permalink: string | null;
  last_error: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishLog {
  id: number;
  post_id: string;
  level: "info" | "error";
  message: string;
  created_at: string;
}

export interface AnalyticsData {
  profile: {
    id: string;
    username: string;
    name: string;
    biography: string;
    profile_picture_url?: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
  };
  metrics: {
    totalFollowers: number;
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    avgLikesPerPost: number;
    avgCommentsPerPost: number;
    engagementRate: number;
  };
  posts: Array<{
    id: string;
    caption: string;
    media_type: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
  }>;
}

export class InstaMontageClient {
  private config: AppConfig;
  private cookie: string | null = null;
  private cookieExpiresAt = 0;

  constructor(customConfig?: Partial<AppConfig>) {
    this.config = { ...getConfig(), ...customConfig };
  }

  private async ensureAuth(): Promise<string> {
    const now = Date.now();
    // Cache cookie for 23 hours (session cookie is valid for 30 days)
    if (this.cookie && now < this.cookieExpiresAt) {
      return this.cookie;
    }

    const res = await fetch(`${this.config.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Authentication failed (${res.status}): ${(err as any).error || res.statusText}`);
    }

    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("Login succeeded but no session cookie was returned by server.");
    }

    this.cookie = setCookie.split(";")[0];
    this.cookieExpiresAt = now + 23 * 3600 * 1000;
    return this.cookie;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cookie = await this.ensureAuth();
    const headers = new Headers(options.headers || {});
    headers.set("Cookie", cookie);

    const url = `${this.config.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      // If 401, invalidate cookie and retry once
      if (res.status === 401 && this.cookie) {
        this.cookie = null;
        return this.request<T>(endpoint, options);
      }
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`API Error [${res.status}] ${endpoint}: ${(data as any).error || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Upload media buffer to Insta Montage Cloudflare KV
   */
  async uploadMedia(media: MediaProcessResult): Promise<{ url: string; key: string; size: number; type: string }> {
    const cookie = await this.ensureAuth();
    const url = `${this.config.baseUrl}/api/upload`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(media.buffer.length),
        Cookie: cookie,
      },
      body: media.buffer,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Upload failed (${res.status}): ${(data as any).error || res.statusText}`);
    }

    return (await res.json()) as { url: string; key: string; size: number; type: string };
  }

  /**
   * List all posts, optionally filtered by status
   */
  async listPosts(status: "all" | "scheduled" | "published" | "failed" | "draft" = "all"): Promise<PostItem[]> {
    return this.request<PostItem[]>(`/api/posts?status=${encodeURIComponent(status)}`);
  }

  /**
   * Get single post details
   */
  async getPost(id: string): Promise<PostItem> {
    return this.request<PostItem>(`/api/posts/${encodeURIComponent(id)}`);
  }

  /**
   * Get logs for a post
   */
  async getPostLogs(id: string): Promise<PublishLog[]> {
    return this.request<PublishLog[]>(`/api/posts/${encodeURIComponent(id)}/logs`);
  }

  /**
   * Create a post (draft or scheduled)
   */
  async createPost(params: {
    media_type: "PHOTO" | "CAROUSEL" | "REEL";
    media_urls: string[];
    caption: string;
    scheduled_at?: string | null;
    status?: "draft" | "scheduled";
  }): Promise<PostItem> {
    return this.request<PostItem>("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: params.media_type,
        media_urls: params.media_urls,
        caption: params.caption || "",
        scheduled_at: params.scheduled_at || null,
        status: params.status || (params.scheduled_at ? "scheduled" : "draft"),
      }),
    });
  }

  /**
   * Update an existing post
   */
  async updatePost(
    id: string,
    params: Partial<{
      media_type: "PHOTO" | "CAROUSEL" | "REEL";
      caption: string;
      media_urls: string[];
      scheduled_at: string | null;
      status: "draft" | "scheduled" | "cancelled";
    }>
  ): Promise<PostItem> {
    return this.request<PostItem>(`/api/posts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Cancel post and free storage
   */
  async cancelPost(id: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/api/posts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  /**
   * Publish post immediately (queued for next cron tick)
   */
  async publishNow(id: string): Promise<{ ok: boolean; queued: boolean; id: string }> {
    return this.request<{ ok: boolean; queued: boolean; id: string }>(
      `/api/posts/${encodeURIComponent(id)}/publish`,
      { method: "POST" }
    );
  }

  /**
   * Retry a failed post
   */
  async retryPost(id: string): Promise<{ ok: boolean; queued: boolean; id: string }> {
    return this.request<{ ok: boolean; queued: boolean; id: string }>(
      `/api/posts/${encodeURIComponent(id)}/retry`,
      { method: "POST" }
    );
  }

  /**
   * Fetch live Instagram account analytics
   */
  async getAnalytics(): Promise<AnalyticsData> {
    return this.request<AnalyticsData>("/api/instagram/analytics");
  }

  /**
   * Fetch Instagram access token status
   */
  async getStatus(): Promise<any> {
    return this.request<any>("/api/instagram/status");
  }

  /**
   * Fetch dashboard summary metrics
   */
  async getStats(): Promise<any> {
    return this.request<any>("/api/stats");
  }
}

