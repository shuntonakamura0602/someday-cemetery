"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ClientApiError } from "@/components/cemetery-provider";
import { useI18n } from "@/components/language-provider";

type PurchaseState = {
  intentId: string;
  graveId: string;
  status: "creating" | "checkout_open" | "unknown" | "paid" | "expired" | "failed" | "review_required";
  entitlement: "active" | "revoked" | "suspended" | "none";
};

export function CheckoutResultExperience() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get("intent");
  const { locale, t, localizeError } = useI18n();
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
      const result = (await response.json()) as PurchaseState & { code?: string; message?: string };
      if (!response.ok) {
        throw new ClientApiError(
          result.code ?? "PURCHASE_UNAVAILABLE",
          result.message ?? "The payment status could not be checked.",
          response.status,
        );
      }
      setState(result);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? localizeError(loadError.message, loadError.code)
          : loadError instanceof Error
            ? localizeError(loadError.message)
            : locale === "ja"
              ? "決済状況を確認できませんでした。"
              : "The payment status could not be checked.",
      );
    } finally {
      setChecking(false);
    }
  }, [intentId, locale, localizeError]);

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
  const statusLabels: Record<PurchaseState["status"], string> = locale === "ja"
    ? {
        creating: "作成中",
        checkout_open: "決済待ち",
        unknown: "確認中",
        paid: "支払い済み",
        expired: "期限切れ",
        failed: "失敗",
        review_required: "確認が必要",
      }
    : {
        creating: "creating",
        checkout_open: "checkout open",
        unknown: "unknown",
        paid: "paid",
        expired: "expired",
        failed: "failed",
        review_required: "review required",
      };

  if (!intentId) {
    return (
      <section className="narrow-page payment-result state-page">
        <span className="result-symbol">○</span>
        <p className="eyebrow">{locale === "ja" ? "決済を終了しました" : "Checkout closed"}</p>
        <h1>{t("payment.cancel")}</h1>
        <Link className="button button-primary" href="/my-graves">
          {locale === "ja" ? "自分の墓碑に戻る" : "Return to my graves"}
        </Link>
      </section>
    );
  }

  if (active && state) {
    return (
      <section className="narrow-page payment-result state-page">
        <span className="result-symbol result-success">✦</span>
        <p className="eyebrow">{locale === "ja" ? "決済を確認しました" : "Payment confirmed"}</p>
        <h1>{t("payment.done")}</h1>
        <p className="lede">
          {locale === "ja"
            ? "この墓碑で、3種類すべてのカスタムデザインと高解像度の記念画像を利用できます。"
            : "All three custom designs and the high-resolution keepsake are now available for this grave."}
        </p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href={`/g/${state.graveId}/customize`}>
            {locale === "ja" ? "墓石を選ぶ" : "Choose a headstone"}
          </Link>
          <Link className="button button-secondary" href={`/g/${state.graveId}`}>
            {locale === "ja" ? "墓碑を訪れる" : "Visit the grave"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="narrow-page payment-result state-page">
      <span className={`result-symbol ${terminalProblem ? "result-warning" : "result-pending"}`}>{terminalProblem ? "!" : "·"}</span>
      <p className="eyebrow">
        {terminalProblem
          ? locale === "ja" ? "確認が必要です" : "Needs a closer look"
          : locale === "ja" ? "安全な決済" : "Secure checkout"}
      </p>
      <h1>{terminalProblem ? locale === "ja" ? "墓碑はそのまま残っています。" : "Your grave is safe." : t("payment.pending")}</h1>
      <p className="lede">
        {terminalProblem
          ? locale === "ja"
            ? "追加の購入は解放されていません。状態が解決しない場合は、このページを残したままサポートへお問い合わせください。"
            : "We have not unlocked another purchase. Keep this page and contact support if the status does not resolve."
          : timedOut
            ? locale === "ja"
              ? "確認に通常より時間がかかっています。重ねて購入せず、下のボタンから同じ注文を確認してください。"
              : "Confirmation is taking longer than usual. Do not purchase again. You can check the same order below."
            : locale === "ja"
              ? "確認には少し時間がかかることがあります。別の決済を開く必要はありません。"
              : "This can take a few moments. You do not need to open another checkout."}
      </p>
      {state ? <p className="pill">{locale === "ja" ? "状態" : "Status"}: {statusLabels[state.status]}</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="actions centered-actions">
        <button className="button button-primary" type="button" onClick={() => void load(true)} disabled={checking}>
          {checking ? locale === "ja" ? "確認しています…" : "Checking…" : t("payment.check")}
        </button>
        {state ? (
          <Link className="button button-secondary" href={`/g/${state.graveId}`}>
            {locale === "ja" ? "墓碑に戻る" : "Back to the grave"}
          </Link>
        ) : (
          <Link className="button button-secondary" href="/my-graves">{t("action.myGraves")}</Link>
        )}
      </div>
    </section>
  );
}
