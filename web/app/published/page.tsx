"use client";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { Alert, Empty, PageHeader, Spinner } from "@/components/ui";
import { PostRow } from "@/components/post-row";
export default function Published() {
  const [posts, setPosts] = useState<Post[] | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Post[]>("/api/posts?status=published").then(setPosts).catch((e) => setErr(e.message)); }, []);
  return <><PageHeader title="Published" sub="Successfully published to Instagram" />
    {err ? <Alert>{err}</Alert> : !posts ? <Spinner /> : posts.length === 0 ? <Empty icon={CheckCircle2} title="No published posts yet" /> :
      <div className="space-y-2">{posts.map((p) => <PostRow key={p.id} post={p} onChange={() => {}} />)}</div>}</>;
}
