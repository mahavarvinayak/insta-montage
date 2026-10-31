"use client";
import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { Alert, Empty, PageHeader, Spinner, cn } from "@/components/ui";
import { PostRow } from "@/components/post-row";
const FILTERS = ["all", "scheduled", "draft", "published", "failed"] as const;
export default function Queue() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("all"); const [posts, setPosts] = useState<Post[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { setErr(null); api<Post[]>(`/api/posts?status=${f}`).then(setPosts).catch((e) => setErr(e.message)); }, [f]);
  useEffect(() => {
    setPosts(null); load();
    // Publishing happens on the cron worker, so refresh while the tab is visible.
    const t = window.setInterval(() => { if (!document.hidden) load(); }, 20_000);
    return () => window.clearInterval(t);
  }, [load]);
  return <>
    <PageHeader title="Content Queue" sub="Chronological, times in IST" />
    <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">{FILTERS.map((x) =>
      <button key={x} onClick={() => setF(x)} className={cn("px-3 h-9 text-[13px] capitalize border-b-2 -mb-px whitespace-nowrap", f === x ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{x === "draft" ? "Drafts" : x}</button>)}</div>
    {err ? <Alert>{err}</Alert> : !posts ? <Spinner /> : posts.length === 0 ? <Empty icon={Inbox} title="Nothing here" hint="Create a post to fill your queue." /> :
      <div className="space-y-2">{posts.map((p) => <PostRow key={p.id} post={p} onChange={load} showRetry={p.status === "failed"} />)}</div>}
  </>;
}
