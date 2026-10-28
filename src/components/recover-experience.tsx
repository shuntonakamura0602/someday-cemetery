"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCemetery, ClientApiError } from "@/components/cemetery-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { clearRecoveryFragment, parseRecoveryFragment, t, type RecoverySecret } from "@/domain";

export function RecoverExperience() {
  const cemetery = useCemetery();
  const runtime = useRuntimeConfig();
  const [secret, setSecret] = useState<RecoverySecret | null>(null);
  const [manualLink, setManualLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ graveId: string; recoveryUrl: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parsed = parseRecoveryFragment(window.location.hash);
      if (parsed) setSecret(parsed);
      if (window.location.hash) clearRecoveryFragment();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function readManualLink() {
    try {
      const url = new URL(manualLink);
      const parsed = parseRecoveryFragment(url.hash);
      if (!parsed) throw new Error("missing");
      setSecret(parsed);
      setManualLink("");
      setError(null);
    } catch {
      setError(t("recovery.invalid"));
    }
  }

  async function restore() {
    if (!secret) return;
    setBusy(true);
    setError(null);
    try {
      const restored = await cemetery.recover(secret.graveId, secret.key, captchaToken ?? undefined);
      setSecret(null);
      setResult({ graveId: restored.grave.id, recoveryUrl: restored.recoveryUrl });
    } catch (restoreError) {
      if (restoreError instanceof ClientApiError && restoreError.code === "AUTH_UNAVAILABLE") {
        setCaptchaToken(null);
        setCaptchaAttempt((attempt) => attempt + 1);
      }
      setError(restoreError instanceof Error ? restoreError.message : t("recovery.invalid"));
    } finally {
      setBusy(false);
    }
  }

  function saveNewLink() {
    if (!result) return;
    const blob = new Blob(
      [`Someday Cemetery private recovery link\n\n${result.recoveryUrl}\n\nAnyone with this link can take over editing this grave. Keep it private.\n`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `someday-cemetery-recovery-${result.graveId}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (result) {
    return (
      <section className="narrow-page recovery-page state-page">
        <span className="result-symbol result-success">✓</span>
        <p className="eyebrow">Access restored</p>
        <h1>{t("recovery.success")}</h1>
        <p className="lede">The old recovery link and the previous browser’s editing access no longer work.</p>
        <section className="card recovery-secret-card">
          <p className="field-label">New private recovery link</p>
          <code>{result.recoveryUrl}</code>
          <p className="notice-box">{t("recovery.warning")}</p>
          <button className="button button-primary" type="button" onClick={saveNewLink}>{t("recovery.save")}</button>
        </section>
        <div className="actions centered-actions">
          <Link className="button button-secondary" href={`/g/${result.graveId}/edit`}>Edit the grave</Link>
          <Link className="button button-ghost" href={`/g/${result.graveId}`}>View the grave</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="narrow-page recovery-page">
      <header>
        <p className="eyebrow">Private recovery</p>
        <h1>Restore editing access.</h1>
        <p className="lede">A recovery link moves control of one grave to this browser. Opening a link alone changes nothing.</p>
      </header>

      <div className="recovery-warning panel">
        <span aria-hidden="true">◇</span>
        <div>
          <h2>A recovery link is a key.</h2>
          <p>{t("recovery.warning")} Restoring access replaces the old key and removes the previous owner session’s ability to edit.</p>
        </div>
      </div>

      {secret ? (
        <section className="card recovery-action-card">
          <p className="field-label">Recovery link read and removed from the address bar</p>
          <p>Grave <code>{secret.graveId}</code> is ready to be restored. The secret will not be shown or placed in a request URL.</p>
          {cemetery.needsAnonymousSession && runtime.turnstileSiteKey ? (
            <div className="field">
              <span className="field-label">Bot check</span>
              <TurnstileWidget key={captchaAttempt} siteKey={runtime.turnstileSiteKey} onToken={setCaptchaToken} />
            </div>
          ) : null}
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <button
            className="button button-primary"
            type="button"
            onClick={restore}
            disabled={busy || Boolean(cemetery.needsAnonymousSession && runtime.turnstileSiteKey && !captchaToken)}
          >
            {busy ? "Restoring access…" : t("recovery.action")}
          </button>
        </section>
      ) : (
        <section className="card recovery-action-card">
          <p className="field-label">No recovery key is loaded</p>
          <p>Open the private link you saved, or paste it below. It is processed only in this browser.</p>
          <div className="field">
            <label htmlFor="recovery-link">Private recovery link</label>
            <textarea
              className="textarea"
              id="recovery-link"
              rows={3}
              autoComplete="off"
              spellCheck={false}
              value={manualLink}
              onChange={(event) => setManualLink(event.target.value)}
            />
          </div>
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <button className="button button-secondary" type="button" onClick={readManualLink} disabled={!manualLink.trim()}>Read this link</button>
        </section>
      )}
    </section>
  );
}
