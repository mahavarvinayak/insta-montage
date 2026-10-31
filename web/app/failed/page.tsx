"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { Alert, Empty, PageHeader, Spinner } from "@/components/ui";
import { PostRow } from "@/components/post-row";
export default function Failed() {
  const [posts, setPosts] = useState<Post[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<Post[]>("/api/posts?status=failed").then(setPosts).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  return <><PageHeader title="Failed Posts" sub="Permanent failures or posts that exhausted retries. Retry re-queues the post; the scheduler runs it within a minute." />
    {err ? <Alert>{err}</Alert> : !posts ? <Spinner /> : posts.length === 0 ? <Empty icon={ShieldCheck} title="No failed posts" hint="Everything is publishing smoothly." /> :
      <div className="space-y-2">{posts.map((p) => <PostRow key={p.id} post={p} onChange={load} showRetry />)}</div>}</>;
}
