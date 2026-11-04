"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/language-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import { createSupabaseBrowserClient } from "@/server/supabase/browser";

export function AdminSignIn() {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const { locale } = useI18n();
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
      setError(locale === "ja" ? "管理者の認証情報を確認できませんでした。" : "The administrator credentials were not accepted.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <section className="narrow-page admin-sign-in">
      <div className="panel admin-sign-in-panel">
        <p className="eyebrow">{locale === "ja" ? "運営者アクセス" : "Operator access"}</p>
        <h1>{locale === "ja" ? "庭の管理室へ。" : "Enter the garden office."}</h1>
        <p className="muted">{locale === "ja" ? <>事前登録済みで、<code>ADMIN_USER_IDS</code>に含まれる永続Supabaseユーザーだけが続行できます。</> : <>Only pre-registered persistent Supabase users listed in <code>ADMIN_USER_IDS</code> can continue.</>}</p>
        {!configured ? <p className="notice-box">{locale === "ja" ? "この環境では共有データベース認証が設定されていません。" : "Shared database authentication is not configured in this environment."}</p> : null}
        <form onSubmit={signIn}>
          <div className="field"><label htmlFor="admin-email">{locale === "ja" ? "メールアドレス" : "Email"}</label><input className="input" id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="field"><label htmlFor="admin-password">{locale === "ja" ? "パスワード" : "Password"}</label><input className="input" id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit" disabled={!configured || busy}>{busy ? (locale === "ja" ? "確認しています…" : "Checking…") : (locale === "ja" ? "ログイン" : "Sign in")}</button>
        </form>
      </div>
    </section>
  );
}
