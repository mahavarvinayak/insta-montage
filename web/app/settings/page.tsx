"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, Button, PageHeader, Spinner } from "@/components/ui";
const Row = ({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) =>
  <div className="flex items-center justify-between py-3 gap-4"><div><p className="text-[13px] font-medium">{label}</p>{detail && <p className="text-[12px] text-muted-foreground break-all">{detail}</p>}</div>
    {ok ? <span className="inline-flex items-center gap-1 text-[12px] text-success"><CheckCircle2 className="h-4 w-4" />Configured</span>
      : <span className="inline-flex items-center gap-1 text-[12px] text-destructive"><XCircle className="h-4 w-4" />Missing</span>}</div>;
export default function Settings() {
  const [cfg, setCfg] = useState<any>(null); const [ig, setIg] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<{ k: "success" | "error"; t: string } | null>(null);
  useEffect(() => { Promise.all([api("/api/config"), api("/api/instagram/status")]).then(([c, i]) => { setCfg(c); setIg(i); }).catch((e) => setErr(e.message)); }, []);
  const testIg = async () => { setBusy("ig"); setMsg(null); try { const s = await api("/api/instagram/status"); setIg(s);
    setMsg(s.ok ? { k: "success", t: `Connected as @${s.username} (${s.media_count} posts)` } : { k: "error", t: s.error }); } catch (e: any) { setMsg({ k: "error", t: e.message }); } setBusy(null); };
  const testTg = async () => { setBusy("tg"); setMsg(null); try { await api("/api/telegram/test", { method: "POST" }); setMsg({ k: "success", t: "Test notification sent to Telegram." }); } catch (e: any) { setMsg({ k: "error", t: e.message }); } setBusy(null); };
  if (err) return <Alert>{err}</Alert>; if (!cfg) return <Spinner />;
  return <><PageHeader title="Settings" sub="Secrets live in Cloudflare Worker environment variables — set them with wrangler secret put." />
    {msg && <div className="mb-4"><Alert kind={msg.k}>{msg.t}</Alert></div>}
    <div className="card px-4 divide-y divide-border mb-4">
      <Row label="Instagram account" ok={!!ig?.ok} detail={ig?.ok ? `@${ig.username}` : ig?.error} />
      <Row label="Meta API token (IG_USER_ID, IG_ACCESS_TOKEN)" ok={cfg.instagram} detail={`Graph host: ${cfg.graphHost} · API ${cfg.apiVersion}`} />
      <Row label="Cloudflare D1 database" ok={cfg.d1} /><Row label="Cloudflare Media Storage (KV)" ok={cfg.storage} detail="Zero-cost, no credit card required" />
      <Row label="Public media URL (PUBLIC_BASE_URL)" ok={cfg.publicBaseUrlOk} detail={cfg.publicBaseUrl} />
      <Row label="Telegram notifications" ok={cfg.telegram} detail="TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID" />
      <div className="py-3 text-[12px] text-muted-foreground">Max attempts: {cfg.maxAttempts} · Scheduler: every minute, {cfg.cronBatch} post per tick · Retention: auto-clean after {cfg.retentionHours || 48}h · Uploads: JPEG {cfg.uploadLimitMb?.image} MB, MP4 {cfg.uploadLimitMb?.video} MB</div>
    </div>
    <p className="text-[12px] text-muted-foreground mb-4">Long-lived Instagram tokens expire after about 60 days. If publishing starts failing with “code 190”, refresh the token with <code>wrangler secret put IG_ACCESS_TOKEN</code>.</p>
    <div className="flex gap-2"><Button loading={busy === "ig"} onClick={testIg}>Test Instagram connection</Button><Button loading={busy === "tg"} onClick={testTg}>Send test notification</Button></div></>;
}
