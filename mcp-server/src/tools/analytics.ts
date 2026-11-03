import { InstaMontageClient } from "../client.js";

export async function getAccountAnalytics(client: InstaMontageClient) {
  const data = await client.getAnalytics();
  return {
    account: {
      username: `@${data.profile.username}`,
      name: data.profile.name,
      followers: data.profile.followers_count,
      following: data.profile.follows_count,
      totalPosts: data.profile.media_count,
    },
    performance: {
      engagementRate: `${data.metrics.engagementRate}%`,
      avgLikesPerPost: Math.round(data.metrics.avgLikesPerPost),
      avgCommentsPerPost: Math.round(data.metrics.avgCommentsPerPost),
      totalLikesSampled: data.metrics.totalLikes,
      totalCommentsSampled: data.metrics.totalComments,
    },
    topPosts: (data.posts || []).slice(0, 5).map(p => ({
      id: p.id,
      media_type: p.media_type,
      likes: p.like_count,
      comments: p.comments_count,
      permalink: p.permalink,
      timestamp: p.timestamp,
      caption: p.caption ? (p.caption.length > 50 ? p.caption.slice(0, 50) + "..." : p.caption) : "",
    })),
  };
}

export async function getSystemHealth(client: InstaMontageClient) {
  const [status, stats] = await Promise.all([
    client.getStatus(),
    client.getStats(),
  ]);

  return {
    metaToken: {
      configured: status.configured,
      valid: status.token?.is_valid ?? false,
      expiresAt: status.token?.expires_at ? (status.token.expires_at === 0 ? "Never (Permanent)" : new Date(status.token.expires_at * 1000).toISOString()) : "Unknown",
      instagramUsername: status.account?.username ? `@${status.account.username}` : "Not connected",
      permissions: status.token?.scopes || [],
    },
    queue: {
      scheduledPosts: stats.scheduled,
      publishedThisMonth: stats.publishedThisMonth,
      failedPosts: stats.failed,
      nextScheduledPost: stats.next ? {
        id: stats.next.id,
        type: stats.next.media_type,
        time: stats.next.scheduled_at,
        caption: stats.next.caption?.slice(0, 50),
      } : null,
    },
  };
}

