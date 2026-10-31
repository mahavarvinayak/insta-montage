"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, ListOrdered, PlusSquare, CheckCircle2, AlertTriangle, Settings, LogOut, Menu, X, Instagram, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { cn, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid }, { href: "/queue/", label: "Content Queue", icon: ListOrdered },
  { href: "/create/", label: "Create Post", icon: PlusSquare }, { href: "/analytics/", label: "Analytics & Insights", icon: BarChart3 },
  { href: "/published/", label: "Published", icon: CheckCircle2 },
  { href: "/failed/", label: "Failed Posts", icon: AlertTriangle }, { href: "/settings/", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [ready, setReady] = useState(false); const [open, setOpen] = useState(false);
  const isLogin = path.startsWith("/login");
  useEffect(() => {
    if (isLogin) { setReady(true); return; }
    api("/api/auth/me").then(() => setReady(true)).catch(() => { setReady(true); router.replace("/login/"); });
  }, [isLogin]);
  useEffect(() => setOpen(false), [path]);
  if (isLogin) return <>{children}</>;
  if (!ready) return <Spinner />;
  const logout = async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login/"); };
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: I }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, ""));
        return <Link key={href} href={href} className={cn("flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] transition-colors",
          active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}>
          <I className="h-4 w-4" />{label}</Link>;
      })}
    </nav>);
  const brand = <div className="flex items-center gap-2 px-2.5 mb-6"><div className="h-6 w-6 rounded-md bg-primary text-primary-foreground grid place-items-center"><Instagram className="h-3.5 w-3.5" /></div><span className="font-semibold text-[13px]">Insta Montage</span></div>;
  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card px-3 py-5 sticky top-0 h-screen">
        {brand}{nav}
        <button onClick={logout} className="mt-auto flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted"><LogOut className="h-4 w-4" />Sign out</button>
      </aside>
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-12 border-b border-border bg-card flex items-center justify-between px-4">
        <span className="font-semibold text-[13px]">Insta Montage</span>
        <button onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {open && <div className="md:hidden fixed inset-0 top-12 z-20 bg-card p-4">{nav}<button onClick={logout} className="mt-4 text-[13px] text-muted-foreground">Sign out</button></div>}
      <main className="flex-1 min-w-0 px-4 md:px-10 py-6 md:py-10 mt-12 md:mt-0"><div className="max-w-5xl mx-auto">{children}</div></main>
    </div>);
}
