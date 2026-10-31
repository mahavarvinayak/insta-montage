"use client";
import { useEffect, useState } from "react";
import { BarChart3, Heart, MessageCircle, RefreshCw, ExternalLink, Users, Image as ImageIcon, TrendingUp } from "lucide-react";
import { api, fmtIST } from "@/lib/api";
import { Alert, Button, PageHeader, Spinner, TypeBadge } from "@/components/ui";

interface AnalyticsData {
  ok: boolean;
  error?: string;
  profile: {
    username: string;
    name: string;
    profile_picture_url: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
  };
  summary: {
    totalPosts: number;
    recentPostsCount: number;
    totalLikes: number;
    totalComments: number;
    avgEngagement: number;
  };
  posts: Array<{
    id: string;
    caption: string;
    media_type: string;
    media_product_type?: string;
    like_count: number;
    comments_count: number;
    timestamp: string;
    permalink: string;
    thumbnail_url?: string;
  }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api<AnalyticsData>("/api/instagram/analytics");
      if (!res.ok) throw new Error(res.error || "Failed to load analytics");
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Analytics & Insights"
        sub="Track your content performance, reach, likes, and comments directly from Instagram"
        action={
          <Button variant="outline" loading={refreshing} onClick={() => loadData(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh data
          </Button>
        }
      />

      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      {data && (
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {data.profile.profile_picture_url ? (
                <img
                  src={data.profile.profile_picture_url}
                  alt={data.profile.username}
                  className="h-14 w-14 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-lg">
                  {data.profile.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold">{data.profile.name || data.profile.username}</h2>
                <a
                  href={`https://instagram.com/${data.profile.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                >
                  @{data.profile.username}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-6 sm:border-l sm:border-border sm:pl-6 text-center">
              <div>
                <p className="text-xl font-bold">{data.profile.followers_count}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Followers</p>
              </div>
              <div>
                <p className="text-xl font-bold">{data.profile.follows_count}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Following</p>
              </div>
              <div>
                <p className="text-xl font-bold">{data.profile.media_count}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Posts</p>
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total Likes</span>
                <Heart className="h-4 w-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold mt-2">{data.summary.totalLikes}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Across recent posts</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total Comments</span>
                <MessageCircle className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold mt-2">{data.summary.totalComments}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Direct engagement</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Avg Engagement</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold mt-2">{data.summary.avgEngagement}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">Engagement per post</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Posts Analyzed</span>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold mt-2">{data.summary.recentPostsCount}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Recent active posts</p>
            </div>
          </div>

          {/* Visual Performance Chart */}
          {data.posts.length > 0 ? (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Post Engagement Performance</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Comparison of Likes and Comments across recent posts</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Likes</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Comments</span>
                </div>
              </div>

              {/* Bar Chart Representation */}
              <div className="space-y-3 pt-2">
                {data.posts.slice(0, 10).map((post, idx) => {
                  const maxLikes = Math.max(...data.posts.map((p) => p.like_count), 1);
                  const maxComments = Math.max(...data.posts.map((p) => p.comments_count), 1);
                  const maxTotal = Math.max(maxLikes, maxComments, 5);

                  const likeWidth = Math.max(4, Math.round((post.like_count / maxTotal) * 100));
                  const commentWidth = Math.max(4, Math.round((post.comments_count / maxTotal) * 100));

                  return (
                    <div key={post.id} className="group p-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium truncate max-w-[260px] sm:max-w-md">
                          {post.caption || `Post #${idx + 1}`}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                          {fmtIST(post.timestamp, { day: "2-digit", month: "short" })}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {/* Likes Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-rose-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${likeWidth}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium w-8 text-right text-rose-500">{post.like_count}</span>
                        </div>

                        {/* Comments Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${commentWidth}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium w-8 text-right text-blue-500">{post.comments_count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold">No Content on Instagram Feed Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Once posts or reels are live on your Instagram account (@{data.profile.username}), their likes, comments, and engagement rates will show up here automatically!
              </p>
            </div>
          )}

          {/* Posts Breakdown Table */}
          {data.posts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Recent Posts Breakdown</h3>
              </div>
              <div className="divide-y divide-border">
                {data.posts.map((post) => (
                  <div key={post.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {post.thumbnail_url ? (
                        <img
                          src={post.thumbnail_url}
                          alt=""
                          className="h-11 w-11 rounded-md object-cover border border-border shrink-0 bg-muted"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-md bg-muted border border-border grid place-items-center shrink-0">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <TypeBadge t={post.media_type} />
                          <span className="text-[11px] text-muted-foreground">
                            {fmtIST(post.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 truncate mt-1">{post.caption || "No caption"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        {post.like_count}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                        {post.comments_count}
                      </span>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="View on Instagram"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
