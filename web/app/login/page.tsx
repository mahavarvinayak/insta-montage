"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Instagram } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, Button } from "@/components/ui";
export default function Login() {
  const r = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setErr(null);
    try { await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); r.push("/"); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); } };
  return <div className="min-h-screen grid place-items-center px-4">
    <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
      <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center"><Instagram className="h-4 w-4" /></div><span className="font-semibold">Insta Montage</span></div>
      <p className="text-muted-foreground text-[13px]">Private admin access.</p>
      <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label">Password</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {err && <Alert>{err}</Alert>}
      <Button variant="primary" className="w-full h-9" loading={loading}>Sign in</Button>
    </form></div>;
}
