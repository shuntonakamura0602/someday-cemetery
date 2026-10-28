"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useRuntimeConfig } from "@/components/runtime-config";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";

export function AdminSignIn() {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = runtime.dataBackend === "supabase" && runtime.supabaseUrl && runtime.supabasePublishableKey;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!runtime.supabaseUrl || !runtime.supabasePublishableKey) return;
    setBusy(true);
    setError(null);
    const client = createSupabaseBrowserClient(runtime.supabaseUrl, runtime.supabasePublishableKey);
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError("The administrator credentials were not accepted.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <section className="narrow-page admin-sign-in">
      <div className="panel admin-sign-in-panel">
        <p className="eyebrow">Operator access</p>
        <h1>Enter the garden office.</h1>
        <p className="muted">Only pre-registered persistent Supabase users listed in <code>ADMIN_USER_IDS</code> can continue.</p>
        {!configured ? <p className="notice-box">Shared database authentication is not configured in this environment.</p> : null}
        <form onSubmit={signIn}>
          <div className="field"><label htmlFor="admin-email">Email</label><input className="input" id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="field"><label htmlFor="admin-password">Password</label><input className="input" id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={!configured || busy}>{busy ? "Checking…" : "Sign in"}</button>
        </form>
      </div>
    </section>
  );
}
