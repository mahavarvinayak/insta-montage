"use client";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";
import type { Status } from "@/lib/api";
import { isVideo } from "@/lib/api";
export const cn = (...a: any[]) => twMerge(clsx(a));

type BtnVariant = "primary" | "outline" | "ghost" | "danger";
export function Button({ variant = "outline", loading, className, children, ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const v = { primary: "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
    outline: "bg-card border-border hover:bg-muted", ghost: "border-transparent hover:bg-muted",
    danger: "bg-card border-border text-destructive hover:bg-destructive/5" }[variant];
  return <button {...p} disabled={p.disabled || loading}
    className={cn("inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none", v, className)}>
    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{children}</button>;
}

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground", scheduled: "bg-primary/10 text-primary",
  publishing: "bg-warning/10 text-warning", published: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground line-through",
};
export const StatusBadge = ({ status }: { status: Status }) =>
  <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium capitalize", STATUS_STYLE[status])}>{status}</span>;
export const TypeBadge = ({ t }: { t: "CAROUSEL" | "REEL" }) =>
  <span className="inline-flex items-center h-5 px-1.5 rounded border border-border text-[10px] font-semibold tracking-wide text-muted-foreground">{t}</span>;

export function Thumb({ url, className }: { url?: string; className?: string }) {
  if (!url) return <div className={cn("bg-muted rounded-md", className)} />;
  return isVideo(url)
    ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className={cn("object-cover rounded-md bg-muted", className)} />
    : <img src={url} alt="" className={cn("object-cover rounded-md bg-muted", className)} />;
}

export const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
export function Empty({ title, hint, icon: Icon }: { title: string; hint?: string; icon: any }) {
  return <div className="card flex flex-col items-center justify-center text-center py-14 px-6">
    <Icon className="h-6 w-6 text-muted-foreground mb-3" /><p className="font-medium">{title}</p>
    {hint && <p className="text-muted-foreground text-[13px] mt-1">{hint}</p>}</div>;
}
export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: React.ReactNode }) {
  const s = { error: "border-destructive/30 bg-destructive/5 text-destructive", success: "border-success/30 bg-success/5 text-success", info: "border-primary/30 bg-primary/5 text-primary" }[kind];
  return <div className={cn("rounded-md border px-3 py-2 text-[13px]", s)}>{children}</div>;
}
export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) =>
  <div className="flex items-end justify-between gap-4 mb-6"><div><h1 className="h1">{title}</h1>{sub && <p className="text-muted-foreground mt-1">{sub}</p>}</div>{action}</div>;
