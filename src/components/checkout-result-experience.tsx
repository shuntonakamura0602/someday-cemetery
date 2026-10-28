"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { t } from "@/domain";

type PurchaseState = {
  intentId: string;
  graveId: string;
  status: "creating" | "checkout_open" | "unknown" | "paid" | "expired" | "failed" | "review_required";
  entitlement: "active" | "revoked" | "suspended" | "none";
};

export function CheckoutResultExperience() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get("intent");
  const [state, setState] = useState<PurchaseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (recheck = false) => {
    if (!intentId) return;
    setChecking(true);
    try {
      const response = await fetch(
        `/api/purchases/${encodeURIComponent(intentId)}${recheck ? "/recheck" : ""}`,
        recheck ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" } : { cache: "no-store" },
      );
      const result = (await response.json()) as PurchaseState & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The payment status could not be checked.");
      setState(result);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The payment status could not be checked.");
    } finally {
      setChecking(false);
    }
  }, [intentId]);

  useEffect(() => {
    if (!intentId) return;
    let active = true;
    const started = Date.now();
    let timeout: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!active) return;
      await load(false);
      if (!active) return;
      if (Date.now() - started >= 60_000) {
        setTimedOut(true);
        return;
      }
      timeout = setTimeout(tick, 3_000);
    };
    void tick();
    return () => { active = false; clearTimeout(timeout); };
  }, [intentId, load]);

  const active = state?.entitlement === "active";
  const terminalProblem = state && ["failed", "expired", "review_required"].includes(state.status);

  if (!intentId) {
    return (
      <section className="narrow-page payment-result state-page">
        <span className="result-symbol">○</span>
        <p className="eyebrow">Checkout closed</p>
        <h1>{t("payment.cancel")}</h1>
        <Link className="button button-primary" href="/my-graves">Return to my graves</Link>
      </section>
    );
  }

  if (active && state) {
    return (
      <section className="narrow-page payment-result state-page">
        <span className="result-symbol result-success">✦</span>
        <p className="eyebrow">Payment confirmed</p>
        <h1>{t("payment.done")}</h1>
        <p className="lede">All three custom designs and the high-resolution keepsake are now available for this grave.</p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href={`/g/${state.graveId}/customize`}>Choose a headstone</Link>
          <Link className="button button-secondary" href={`/g/${state.graveId}`}>Visit the grave</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="narrow-page payment-result state-page">
      <span className={`result-symbol ${terminalProblem ? "result-warning" : "result-pending"}`}>{terminalProblem ? "!" : "·"}</span>
      <p className="eyebrow">{terminalProblem ? "Needs a closer look" : "Secure checkout"}</p>
      <h1>{terminalProblem ? "Your grave is safe." : t("payment.pending")}</h1>
      <p className="lede">
        {terminalProblem
          ? "We have not unlocked another purchase. Keep this page and contact support if the status does not resolve."
          : timedOut
            ? "Confirmation is taking longer than usual. Do not purchase again. You can check the same order below."
            : "This can take a few moments. You do not need to open another checkout."}
      </p>
      {state ? <p className="pill">Status: {state.status.replaceAll("_", " ")}</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="actions centered-actions">
        <button className="button button-primary" type="button" onClick={() => void load(true)} disabled={checking}>
          {checking ? "Checking…" : t("payment.check")}
        </button>
        {state ? <Link className="button button-secondary" href={`/g/${state.graveId}`}>Back to the grave</Link> : <Link className="button button-secondary" href="/my-graves">My graves</Link>}
      </div>
    </section>
  );
}
