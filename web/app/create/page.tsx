"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Film, GripVertical, Images, Trash2, UploadCloud } from "lucide-react";
import { api, istToUtc, utcToIst, type Post } from "@/lib/api";
import { Alert, Button, PageHeader, Spinner, cn } from "@/components/ui";

type Kind = "CAROUSEL" | "REEL";
interface Media { url: string; name: string }

async function imageDims(file: File) {
  const url = URL.createObjectURL(file); const img = new Image();
  await new Promise((r, j) => {
    img.onload = r;
    img.onerror = () => j(new Error("Failed to load image file"));
    img.src = url;
  });
  URL.revokeObjectURL(url);
  return { w: img.naturalWidth, h: img.naturalHeight };
}
async function videoMeta(file: File) {
  const url = URL.createObjectURL(file); const v = document.createElement("video"); v.preload = "metadata";
  await new Promise((r, j) => {
    v.onloadedmetadata = r;
    v.onerror = () => j(new Error("Failed to read video metadata"));
    v.src = url;
  });
  URL.revokeObjectURL(url);
  return { d: v.duration, w: v.videoWidth, h: v.videoHeight };
}

/** Instagram's publishing API only accepts JPEG, so convert PNG/WebP before uploading. */
async function toJpeg(file: File): Promise<File> {
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (isJpeg && file.size <= MAX_IMAGE_MB * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const quality = file.size > MAX_IMAGE_MB * 1024 * 1024 ? 0.85 : 0.92;
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Could not convert image to JPEG");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 90; // Cloudflare caps Worker request bodies at 100 MB on the Free plan

function Editor() {
  const router = useRouter(); const params = useSearchParams(); const editId = params.get("id");
  const [kind, setKind] = useState<Kind>("CAROUSEL"); const [media, setMedia] = useState<Media[]>([]);
  const [caption, setCaption] = useState(""); const def = utcToIst(new Date(Date.now() + 3600_000).toISOString());
  const [date, setDate] = useState(def.date); const [time, setTime] = useState(def.time.slice(0, 3) + "00");
  const [uploading, setUploading] = useState(0); const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]); const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!editId); const [slide, setSlide] = useState(0); const [over, setOver] = useState(false);
  const [username, setUsername] = useState("yourbrand");
  const dragIdx = useRef<number | null>(null); const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api("/api/instagram/status").then((s) => { if (s?.username) setUsername(s.username); }).catch(() => {});
  }, []);

  useEffect(() => { if (!editId) return;
    api<Post>(`/api/posts/${editId}`).then((p) => { setKind(p.media_type); setCaption(p.caption);
      setMedia(p.media_urls.map((u, i) => ({ url: u, name: `Item ${i + 1}` })));
      if (p.scheduled_at) { const t = utcToIst(p.scheduled_at); setDate(t.date); setTime(t.time); } })
      .catch((e) => setErrors([e.message])).finally(() => setLoading(false)); }, [editId]);

  const handleFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const list = kind === "REEL" ? incoming.slice(0, 1) : incoming;
    const errs: string[] = [];
    const uploaded: Media[] = [];
    for (const raw of list) {
      try {
        let file = raw;
        if (kind === "CAROUSEL") {
          const isImg = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(raw.type.toLowerCase()) || /\.(jpe?g|png|webp)$/i.test(raw.name);
          if (!isImg) { errs.push(`${raw.name}: carousel accepts JPEG, PNG or WebP`); continue; }
          file = await toJpeg(raw);
          if (file.size > MAX_IMAGE_MB * 1024 * 1024) { errs.push(`${raw.name}: must be under ${MAX_IMAGE_MB} MB as JPEG`); continue; }
          const { w, h } = await imageDims(file); const r = w / h;
          if (r < 0.8 - 0.01 || r > 1.91 + 0.01) { errs.push(`${raw.name}: aspect ratio ${r.toFixed(2)} outside Instagram's 4:5–1.91:1`); continue; }
          if (w < 320) { errs.push(`${raw.name}: width must be at least 320px`); continue; }
        } else {
          const isMp4 = raw.type === "video/mp4" || /\.mp4$/i.test(raw.name);
          if (!isMp4) { errs.push(`${raw.name}: Reels must be MP4`); continue; }
          if (raw.size > MAX_VIDEO_MB * 1024 * 1024) { errs.push(`${raw.name}: must be under ${MAX_VIDEO_MB} MB`); continue; }
          const { d } = await videoMeta(raw);
          if (d < 3 || d > 900) { errs.push(`${raw.name}: duration ${Math.round(d)}s must be 3s–15min`); continue; }
        }
        setUploading((n) => n + 1);
        const r = await api<{ url: string }>("/api/upload", { method: "POST", body: file });
        uploaded.push({ url: r.url, name: raw.name });
      } catch (e: any) { errs.push(`${raw.name}: ${e.message}`); }
      finally { setUploading((n) => Math.max(0, n - 1)); }
    }

    if (kind === "REEL") {
      if (uploaded[0]) { setMedia([uploaded[0]]); setSlide(0); }
    } else if (uploaded.length) {
      const merged = [...media, ...uploaded];
      if (merged.length > 10) errs.push("Carousel is limited to 10 images — extra files were skipped.");
      setMedia(merged.slice(0, 10));
    }
    if (errs.length) setErrors(errs);
  };

  const move = (i: number, j: number) => setMedia((m) => { if (j < 0 || j >= m.length) return m; const c = [...m]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c; });
  const tags = (caption.match(/#\w+/g) || []).length;

  const validate = (needSchedule: boolean) => {
    const e: string[] = [];
    if (kind === "CAROUSEL" && (media.length < 2 || media.length > 10)) e.push("Carousel needs 2–10 images.");
    if (kind === "REEL" && media.length !== 1) e.push("Upload one video for the Reel.");
    if (caption.length > 2200) e.push("Caption exceeds 2,200 characters.");
    if (tags > 30) e.push("Max 30 hashtags.");
    if (needSchedule) {
      if (!date || !time) e.push("Pick a scheduled date and time.");
      else if (new Date(istToUtc(date, time)).getTime() < Date.now() - 60_000) e.push("Scheduled time is in the past.");
    }
    setErrors(e); return e.length === 0;
  };

  const save = async (mode: "draft" | "scheduled" | "now") => {
    setOk(null); if (!validate(mode === "scheduled")) return; setBusy(mode);
    const scheduledAt = mode === "now" ? new Date().toISOString() : (date && time ? istToUtc(date, time) : null);
    const body = { media_type: kind, caption, media_urls: media.map((m) => m.url),
      scheduled_at: scheduledAt, status: mode === "scheduled" ? "scheduled" : "draft" };
    try {
      const post = editId ? await api<Post>(`/api/posts/${editId}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<Post>("/api/posts", { method: "POST", body: JSON.stringify(body) });
      if (mode === "now") {
        await api(`/api/posts/${post.id}/publish`, { method: "POST" });
        setOk("Queued for publishing. The scheduler picks it up within a minute — follow it in Content Queue.");
        setBusy(null);
        setTimeout(() => router.push("/queue/"), 1600);
        return;
      }
      router.push("/queue/");
    } catch (e: any) { setErrors([e.message]); }
    setBusy(null);
  };

  if (loading) return <Spinner />;
  const preview = media[Math.min(slide, media.length - 1)];
  return <>
    <PageHeader title={editId ? "Edit Post" : "Create Post"} sub="Schedule in Asia/Kolkata time" />
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        <div className="card p-1 inline-flex gap-1">{(["CAROUSEL", "REEL"] as Kind[]).map((k) =>
          <button key={k} disabled={!!editId} onClick={() => { setKind(k); setMedia([]); setErrors([]); }}
            className={cn("h-8 px-3 rounded-md text-[13px] inline-flex items-center gap-1.5", kind === k ? "bg-muted font-medium" : "text-muted-foreground")}>
            {k === "CAROUSEL" ? <Images className="h-4 w-4" /> : <Film className="h-4 w-4" />}{k === "CAROUSEL" ? "Carousel" : "Reel"}</button>)}</div>

        <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
          className={cn("card border-dashed cursor-pointer p-8 text-center transition-colors", over && "border-primary bg-primary/5")}>
          <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-2 font-medium text-[13px]">{uploading ? "Uploading…" : "Drop files or click to upload"}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{kind === "CAROUSEL" ? `2–10 images · JPEG, PNG or WebP (converted to JPEG) · 4:5 to 1.91:1 · max ${MAX_IMAGE_MB} MB` : `1 MP4 video · 3s–15min · 9:16 recommended · max ${MAX_VIDEO_MB} MB`}</p>
          <input ref={fileInput} type="file" hidden multiple={kind === "CAROUSEL"} accept={kind === "CAROUSEL" ? "image/jpeg,image/png,image/webp" : "video/mp4"}
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {kind === "CAROUSEL" && media.length > 0 && <div className="card p-3">
          <p className="text-[12px] text-muted-foreground mb-2">Order ({media.length}/10) — drag or use arrows</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{media.map((m, i) =>
            <div key={m.url} draggable onDragStart={() => (dragIdx.current = i)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.stopPropagation(); if (dragIdx.current !== null) move(dragIdx.current, i); dragIdx.current = null; }}
              className="group relative rounded-md border border-border overflow-hidden bg-muted cursor-grab">
              <img src={m.url} alt="" className="aspect-square w-full object-cover" />
              <span className="absolute top-1 left-1 text-[10px] font-semibold bg-card/90 rounded px-1">{i + 1}</span>
              <GripVertical className="absolute top-1 right-1 h-3.5 w-3.5 text-card drop-shadow" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-card/90 p-0.5">
                <button type="button" onClick={() => move(i, i - 1)} aria-label="Move left"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => { setMedia(media.filter((_, j) => j !== i)); setSlide((s) => Math.max(0, Math.min(s, media.length - 2))); }} aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                <button type="button" onClick={() => move(i, i + 1)} aria-label="Move right"><ArrowRight className="h-3.5 w-3.5" /></button></div>
            </div>)}</div></div>}

        <div className="card p-4 space-y-4">
          <div><label className="label">Caption & hashtags</label>
            <textarea className="input h-36 py-2 resize-y" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write your caption… #ai #creator" />
            <p className={cn("text-[11px] mt-1 text-right", caption.length > 2200 || tags > 30 ? "text-destructive" : "text-muted-foreground")}>{caption.length}/2200 · {tags}/30 hashtags</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date (IST)</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label">Time (IST)</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div></div>
        </div>
        {errors.length > 0 && <Alert>{errors.map((e) => <div key={e}>{e}</div>)}</Alert>}
        {ok && <Alert kind="info">{ok}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy === "scheduled"} disabled={!!busy || uploading > 0} onClick={() => save("scheduled")}>Schedule post</Button>
          <Button loading={busy === "draft"} disabled={!!busy || uploading > 0} onClick={() => save("draft")}>Save as draft</Button>
          <Button loading={busy === "now"} disabled={!!busy || uploading > 0} onClick={() => confirm("Publish to Instagram now?") && save("now")}>Publish now</Button>
        </div>
      </div>

      <div className="lg:col-span-2"><div className="card p-3 sticky top-6">
        <p className="text-[12px] font-medium text-muted-foreground mb-2">Preview</p>
        <div className="flex items-center gap-2 mb-2"><div className="h-6 w-6 rounded-full bg-muted" /><span className="text-[12px] font-semibold">{username}</span></div>
        <div className={cn("relative bg-muted rounded-md overflow-hidden", kind === "REEL" ? "aspect-[9/16]" : "aspect-[4/5]")}>
          {preview ? kind === "REEL" ? <video key={preview.url} src={preview.url} controls playsInline className="h-full w-full object-cover" />
            : <img src={preview.url} alt="" className="h-full w-full object-cover" />
            : <div className="h-full grid place-items-center text-[12px] text-muted-foreground">No media yet</div>}
          {kind === "CAROUSEL" && media.length > 1 && <>
            <button onClick={() => setSlide(Math.max(0, slide - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/90 grid place-items-center"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setSlide(Math.min(media.length - 1, slide + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/90 grid place-items-center"><ChevronRight className="h-4 w-4" /></button>
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">{media.map((_, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === slide ? "bg-primary" : "bg-card/80")} />)}</div></>}
        </div>
        <p className="text-[12px] mt-2 whitespace-pre-wrap line-clamp-6"><span className="font-semibold">{username} </span>{caption}</p>
      </div></div>
    </div></>;
}
export default function CreatePage() { return <Suspense fallback={<Spinner />}><Editor /></Suspense>; }
