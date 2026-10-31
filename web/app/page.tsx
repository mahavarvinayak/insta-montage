"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, AlertTriangle, Clock, Inbox } from "lucide-react";
import { api, fmtIST, utcToIst, type Post } from "@/lib/api";
import { Alert, Button, Empty, PageHeader, Spinner, StatusBadge, Thumb, TypeBadge } from "@/components/ui";

export default function Overview() {
  const [stats, setStats] = useState<any>(null); const [queue, setQueue] = useState<Post[]>([]); const [err, setErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => { Promise.all([api("/api/stats"), api<Post[]>("/api/posts?status=scheduled"), api("/api/config").catch(() => null)])
    .then(([s, q, c]) => { setStats(s); setQueue(q); setCfg(c); }).catch((e) => setErr(e.message)); }, []);
  if (err) return <Alert>{err}</Alert>;
  if (!stats) return <Spinner />;
  const next: Post | null = stats.next;
  // 14-day strip
  const days = Array.from({ length: 14 }, (_, i) => utcToIst(new Date(Date.now() + i * 86400_000).toISOString()).date);
  const byDay = (d: string) => queue.filter((p) => p.scheduled_at && utcToIst(p.scheduled_at).date === d);
  const cards = [
    { label: "Scheduled", value: stats.scheduled, icon: CalendarClock },
    { label: "Published this month", value: stats.publishedThisMonth, icon: CheckCircle2 },
    { label: "Failed", value: stats.failed, icon: AlertTriangle },
    { label: "Next post", value: next ? fmtIST(next.scheduled_at, { year: undefined }) : "—", icon: Clock, small: true },
  ];
  return <>
    <PageHeader title="Overview" sub="All times in Asia/Kolkata (IST)" action={<Link href="/create/"><Button variant="primary">New post</Button></Link>} />
    {cfg && (!cfg.instagram || !cfg.publicBaseUrlOk) && <div className="mb-4"><Alert kind="info">
      {!cfg.instagram && <div>Instagram isn’t connected yet — add IG_USER_ID and IG_ACCESS_TOKEN or scheduled posts will fail.</div>}
      {!cfg.publicBaseUrlOk && <div>PUBLIC_BASE_URL isn’t set to this Worker’s real https URL, so Instagram can’t fetch uploaded media.</div>}
    </Alert></div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c) => <div key={c.label} className="card p-4"><div className="flex items-center justify-between text-muted-foreground text-[12px]">{c.label}<c.icon className="h-3.5 w-3.5" /></div>
        <div className={c.small ? "mt-2 text-[13px] font-medium" : "mt-2 text-2xl font-semibold tracking-tight"}>{c.value}</div></div>)}
    </div>
    <div className="grid lg:grid-cols-5 gap-4 mb-6">
      <div className="card p-4 lg:col-span-2">
        <p className="text-[12px] font-medium text-muted-foreground mb-3">Next scheduled post</p>
        {next ? <div>
          {next.media_urls[0] && <Thumb url={next.media_urls[0]} className="w-full aspect-square" />}
          <div className="flex items-center gap-2 mt-3"><TypeBadge t={next.media_type} /><span className="text-[12px] font-medium">{fmtIST(next.scheduled_at)}</span></div>
          <p className="text-[13px] text-foreground/80 mt-2 line-clamp-3">{next.caption}</p>
        </div> : <p className="text-muted-foreground text-[13px]">Nothing scheduled.</p>}
      </div>
      <div className="card p-4 lg:col-span-3">
        <p className="text-[12px] font-medium text-muted-foreground mb-3">Next 14 days</p>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {days.map((d) => {
            const n = byDay(d).length;
            const [y, m, dayNum] = d.split("-").map(Number);
            const dt = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
            return <div key={d} className={`rounded-md border border-border p-1.5 text-center ${n ? "bg-primary/5 border-primary/30" : ""}`}>
              <div className="text-[10px] text-muted-foreground">{dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</div>
              <div className="text-[13px] font-medium">{dt.getUTCDate()}</div>
              <div className="text-[10px] text-primary h-3">{n ? `${n} post${n > 1 ? "s" : ""}` : ""}</div></div>; })}
        </div>
        <p className="text-[12px] font-medium text-muted-foreground mb-2">Upcoming queue</p>
        {queue.length ? <ul className="divide-y divide-border">{queue.slice(0, 6).map((p) =>
          <li key={p.id} className="flex items-center gap-3 py-2"><Thumb url={p.media_urls[0]} className="h-9 w-9" />
            <span className="flex-1 truncate text-[13px]">{p.caption || "No caption"}</span>
            <span className="text-[12px] text-muted-foreground whitespace-nowrap">{fmtIST(p.scheduled_at, { year: undefined })}</span></li>)}</ul>
          : <p className="text-muted-foreground text-[13px]">Queue is empty.</p>}
      </div>
    </div>
    <p className="text-[12px] font-medium text-muted-foreground mb-2">Recent publishing activity</p>
    {stats.activity?.length ? <div className="card divide-y divide-border">{stats.activity.map((a: any) =>
      <div key={a.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${a.level === "error" ? "bg-destructive" : "bg-success"}`} />
        <span className="flex-1 min-w-0 break-words"><span className="text-muted-foreground">{a.media_type ? `${a.media_type.toLowerCase()} · ` : ""}</span>{a.message}</span>
        <span className="text-[12px] text-muted-foreground whitespace-nowrap">{fmtIST(a.created_at, { year: undefined })}</span></div>)}</div>
      : <Empty icon={Inbox} title="No activity yet" hint="Publishing logs will appear here." />}
  </>;
}
