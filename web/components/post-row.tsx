"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Pencil, XCircle, ExternalLink, RotateCcw } from "lucide-react";
import { api, fmtIST, istToUtc, utcToIst, type Post } from "@/lib/api";
import { Button, StatusBadge, Thumb, TypeBadge } from "./ui";

export function PostRow({ post, onChange, showRetry }: { post: Post; onChange: () => void; showRetry?: boolean }) {
  const [resched, setResched] = useState(false);
  const init = post.scheduled_at ? utcToIst(post.scheduled_at) : utcToIst(new Date(Date.now() + 3600_000).toISOString());
  const [date, setDate] = useState(init.date); const [time, setTime] = useState(init.time);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const act = async (k: string, fn: () => Promise<any>) => { setBusy(k); setError(null);
    try { await fn(); onChange(); } catch (e: any) { setError(e.message); } finally { setBusy(null); } };
  const editable = ["draft", "scheduled", "failed"].includes(post.status);

  return (
    <div className="card p-3 flex flex-col sm:flex-row gap-3">
      <div className="relative shrink-0"><Thumb url={post.media_urls?.[0]} className="h-16 w-16" />
        {post.media_type === "CAROUSEL" && <span className="absolute bottom-1 right-1 text-[10px] bg-card/90 rounded px-1">{post.media_urls?.length || 0}</span>}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap"><TypeBadge t={post.media_type} /><StatusBadge status={post.status} />
          <span className="text-[12px] text-muted-foreground">{post.status === "published" ? fmtIST(post.published_at) : post.scheduled_at ? fmtIST(post.scheduled_at) : "Not scheduled"}</span>
          {post.status === "scheduled" && post.next_attempt_at && <span className="text-[12px] text-warning">· retry {fmtIST(post.next_attempt_at, { year: undefined })}</span>}
          {post.attempts > 0 && post.status !== "published" && <span className="text-[12px] text-muted-foreground">· {post.attempts} attempt{post.attempts > 1 ? "s" : ""}</span>}</div>
        <p className="mt-1.5 text-[13px] line-clamp-2 text-foreground/80">{post.caption || <span className="text-muted-foreground italic">No caption</span>}</p>
        {post.last_error && post.status !== "published" && <p className="mt-1.5 text-[12px] text-destructive break-words">{post.last_error}</p>}
        {post.status === "published" && <div className="mt-1.5 text-[12px] text-muted-foreground flex gap-3 flex-wrap">
          {post.instagram_media_id && <span>ID: <code>{post.instagram_media_id}</code></span>}
          {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">View on Instagram <ExternalLink className="h-3 w-3" /></a>}</div>}
        {resched && <div className="mt-3 flex flex-wrap items-end gap-2">
          <input type="date" className="input w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className="input w-32" value={time} onChange={(e) => setTime(e.target.value)} />
          <span className="text-[12px] text-muted-foreground">IST</span>
          <Button variant="primary" loading={busy === "r"} onClick={() => act("r", () => api(`/api/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ scheduled_at: istToUtc(date, time), status: "scheduled" }) }).then(() => setResched(false)))}>Save</Button>
          <Button variant="ghost" onClick={() => setResched(false)}>Cancel</Button></div>}
        {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
      </div>
      {editable && <div className="flex sm:flex-col gap-1.5 shrink-0">
        {showRetry && <Button variant="primary" loading={busy === "retry"} onClick={() => act("retry", () => api(`/api/posts/${post.id}/retry`, { method: "POST" }))}><RotateCcw className="h-3.5 w-3.5" />Retry now</Button>}
        <Link href={`/create/?id=${post.id}`}><Button className="w-full"><Pencil className="h-3.5 w-3.5" />Edit</Button></Link>
        <Button onClick={() => setResched(!resched)}><CalendarClock className="h-3.5 w-3.5" />Reschedule</Button>
        <Button variant="danger" loading={busy === "c"} onClick={() => confirm("Cancel this post?") && act("c", () => api(`/api/posts/${post.id}`, { method: "DELETE" }))}><XCircle className="h-3.5 w-3.5" />Cancel</Button>
      </div>}
    </div>);
}
