"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/language-provider";
import type { Locale } from "@/i18n/config";

type Relation = { title?: string | null; status?: string } | Array<{ title?: string | null; status?: string }> | null;
type Dashboard = {
  reports: Array<{ id: string; grave_id: string; reason: string; details?: string | null; created_at: string; graves: Relation }>;
  hiddenGraves: Array<{ id: string; title: string; status: string; updated_at: string }>;
  paymentReviews: Array<{ id: string; grave_id: string; mode: "sandbox" | "live"; status: string; review_reason?: string | null; updated_at: string; graves: Relation }>;
  activeEntitlements: Array<{ grave_id: string; mode: "sandbox" | "live"; status: string; reason?: string | null; updated_at: string; graves: Relation }>;
  suspendedEntitlements: Array<{ grave_id: string; mode: "sandbox" | "live"; status: string; reason?: string | null; updated_at: string; graves: Relation }>;
  auditLog: Array<{ id: string; admin_user_id: string; grave_id?: string; action: string; reason: string; created_at: string }>;
  paymentMode: "sandbox" | "live";
};

function title(relation: Relation, locale: Locale) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.title || (locale === "ja" ? "利用できない墓碑" : "Unavailable grave");
}

const japaneseLabels: Record<string, string> = {
  spam: "スパム",
  harassment: "嫌がらせ",
  personal_information: "個人情報",
  real_person: "実在する人物",
  other: "その他",
  pending: "処理待ち",
  creating: "購入準備中",
  checkout_created: "購入画面作成済み",
  checkout_open: "決済画面を表示中",
  unknown: "状態不明",
  paid: "支払い済み",
  expired: "期限切れ",
  refunded: "全額返金済み",
  partially_refunded: "一部返金済み",
  disputed: "異議申立て中",
  review_required: "確認が必要",
  succeeded: "完了",
  failed: "失敗",
  active: "有効",
  suspended: "停止中",
  revoked: "取り消し済み",
  sandbox: "Sandbox",
  live: "本番",
  hide: "墓碑を非表示にする",
  republish: "墓碑を再公開する",
  delete: "墓碑を削除する",
  suspend_entitlement: "利用権を停止する",
  restore_entitlement: "利用権を復元する",
  resolve_report: "通報を解決する",
  dismiss_report: "通報を却下する",
  reconcile_payment: "決済を照合する",
  ORDER_PAID: "支払い確認済み",
  OWNER_CHANGED: "所有者が変更されました",
  GRAVE_DELETED: "墓碑が削除されています",
  GRAVE_HIDDEN: "墓碑が非表示になっています",
  DUPLICATE_ORDER: "重複する注文があります",
  FULL_REFUND: "全額返金",
  PROVIDER_DISPUTE: "決済への異議申立て",
  DUPLICATE_PAID_ORDER: "支払い済み注文が重複しています",
  ENTITLEMENT_MANUALLY_SUSPENDED: "利用権が手動で停止されています",
  GRAVE_DELETED_BEFORE_FULFILLMENT: "付与前に墓碑が削除されました",
  HIDDEN_GRAVE_PAID_BEFORE_FULFILLMENT: "非表示の墓碑への支払いを確認しました",
  ORDER_FULLY_REFUNDED: "注文が全額返金されました",
  ORDER_METADATA_MISMATCH: "注文情報が一致しません",
  ORDER_PARTIALLY_REFUNDED: "注文が一部返金されました",
  ORDER_TERMS_MISMATCH: "注文条件が一致しません",
  REFUND_STATE_PRESERVED: "返金後の利用権状態を維持しました",
  CHECKOUT_CREATE_UNCERTAIN: "決済の開始結果を確認できません",
  CHECKOUT_ID_MISSING: "決済情報が見つかりません",
  CHECKOUT_TERMS_MISMATCH: "決済条件が一致しません",
  MULTIPLE_ORDERS_FOR_CHECKOUT: "この決済に複数の注文があります",
  ORDER_RECONCILIATION_FAILED: "注文の照合に失敗しました",
  PROVIDER_ORDER_PROCESSING_FAILED: "決済事業者の注文を処理できませんでした",
  PROVIDER_RECONCILIATION_FAILED: "決済事業者との照合に失敗しました",
  SUCCEEDED_CHECKOUT_WITHOUT_ORDER: "完了した決済の注文が見つかりません",
};

function codeLabel(value: string, locale: Locale): string {
  if (locale === "ja") return japaneseLabels[value] ?? value.replaceAll("_", " ");
  return value.replaceAll("_", " ");
}

function reasonLabel(value: string, locale: Locale): string {
  if (locale === "ja") return japaneseLabels[value] ?? value;
  return value;
}

export function AdminDashboard() {
  const { locale, formatDate, localizeError } = useI18n();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const result = (await response.json()) as Dashboard & { message?: string; code?: string };
    if (!response.ok) throw new Error(localizeError(result.message ?? "The moderation queue could not be loaded.", result.code));
    setData(result);
    setError(null);
  }, [localizeError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) => setError(
        loadError instanceof Error
          ? localizeError(loadError.message)
          : locale === "ja" ? "読み込めませんでした。" : "Could not load.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, locale, localizeError]);

  async function post(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!response.ok) throw new Error(localizeError(result.message ?? "The operation did not complete.", result.code));
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? localizeError(actionError.message)
          : locale === "ja" ? "操作を完了できませんでした。" : "The operation did not complete.",
      );
    } finally {
      setBusy(null);
    }
  }

  function reasonFor(action: string) {
    return window.prompt(locale === "ja" ? `${codeLabel(action, locale)}の理由：` : `Reason for ${codeLabel(action, locale)}:`)?.trim() || null;
  }

  async function moderate(graveId: string, action: string, mode?: string) {
    const reason = reasonFor(action);
    if (!reason) return;
    await post("/api/admin/moderation", { graveId, action, reason, mode }, `${graveId}:${action}`);
  }

  async function report(reportId: string, action: string) {
    const reason = reasonFor(action);
    if (!reason) return;
    await post(`/api/admin/reports/${reportId}`, { action, reason }, `${reportId}:${action}`);
  }

  async function reconcile(intentId: string) {
    const reason = reasonFor("reconcile_payment");
    if (!reason) return;
    await post(`/api/admin/reconcile/${intentId}`, { reason }, intentId);
  }

  if (error && !data) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">{locale === "ja" ? "運営者アクセス" : "Operator access"}</p><h1>{locale === "ja" ? "庭の管理室は施錠されています。" : "The garden office is locked."}</h1><p className="lede">{error}</p>
        <Link className="button button-primary" href="/admin/sign-in">{locale === "ja" ? "管理者ログイン" : "Administrator sign in"}</Link>
      </section>
    );
  }
  if (!data) return <div className="narrow-page state-page">{locale === "ja" ? "庭の管理室を開いています…" : "Opening the garden office…"}</div>;

  return (
    <section className="wide-page admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">{locale === "ja" ? "庭の管理室" : "Garden office"}</p><h1>{locale === "ja" ? "モデレーションと決済。" : "Moderation and payments."}</h1></div>
        <button className="button button-secondary" type="button" onClick={() => void load()}>{locale === "ja" ? "更新" : "Refresh"}</button>
      </header>
      {error ? <p className="error-message" role="alert">{error}</p> : null}

      <div className="admin-summary">
        <div><strong>{data.reports.length}</strong><span>{locale === "ja" ? "未解決の通報" : "Open reports"}</span></div>
        <div><strong>{data.hiddenGraves.length}</strong><span>{locale === "ja" ? "非表示の墓碑" : "Hidden graves"}</span></div>
        <div><strong>{data.paymentReviews.length}</strong><span>{locale === "ja" ? "決済確認" : "Payment reviews"}</span></div>
        <div><strong>{data.activeEntitlements.length}</strong><span>{locale === "ja" ? "有効な利用権" : "Active rights"}</span></div>
        <div><strong>{data.suspendedEntitlements.length}</strong><span>{locale === "ja" ? "停止中の利用権" : "Suspended rights"}</span></div>
      </div>

      <section className="admin-section">
        <h2>{locale === "ja" ? "未解決の通報" : "Open reports"}</h2>
        {!data.reports.length ? <div className="empty-state">{locale === "ja" ? "未解決の通報はありません。" : "No open reports."}</div> : null}
        <div className="admin-list">
          {data.reports.map((item) => (
            <article className="card admin-row" key={item.id}>
              <div><p className="eyebrow">{codeLabel(item.reason, locale)}</p><h3>{title(item.graves, locale)}</h3><p>{item.details || (locale === "ja" ? "追加情報はありません。" : "No additional details.")}</p><span className="tiny muted">{formatDate(item.created_at, { dateStyle: "medium", timeStyle: "short" })}</span></div>
              <div className="actions">
                <Link className="button button-small button-secondary" href={`/g/${item.grave_id}`}>{locale === "ja" ? "確認" : "Inspect"}</Link>
                <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(item.grave_id, "hide")}>{locale === "ja" ? "墓碑を非表示" : "Hide grave"}</button>
                <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void report(item.id, "resolve_report")}>{locale === "ja" ? "解決" : "Resolve"}</button>
                <button className="button button-small button-ghost" type="button" disabled={Boolean(busy)} onClick={() => void report(item.id, "dismiss_report")}>{locale === "ja" ? "却下" : "Dismiss"}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>{locale === "ja" ? "非表示の墓碑" : "Hidden graves"}</h2>
        {!data.hiddenGraves.length ? <div className="empty-state">{locale === "ja" ? "非表示の墓碑はありません。" : "No hidden graves."}</div> : null}
        <div className="admin-list">
          {data.hiddenGraves.map((grave) => (
            <article className="card admin-row" key={grave.id}>
              <div><h3>{grave.title}</h3><span className="tiny muted">{locale === "ja" ? "非表示：" : "Hidden "}{formatDate(grave.updated_at, { dateStyle: "medium", timeStyle: "short" })}</span></div>
              <div className="actions">
                <button className="button button-small button-primary" type="button" disabled={Boolean(busy)} onClick={() => void moderate(grave.id, "republish")}>{locale === "ja" ? "再公開" : "Republish"}</button>
                <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(grave.id, "delete")}>{locale === "ja" ? "削除" : "Delete"}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>{locale === "ja" ? "決済確認" : "Payment review"} · {codeLabel(data.paymentMode, locale)}</h2>
        {!data.paymentReviews.length ? <div className="empty-state">{locale === "ja" ? "未解決の決済処理はありません。" : "No unresolved payment intents."}</div> : null}
        <div className="admin-list">
          {data.paymentReviews.map((intent) => (
            <article className="card admin-row" key={intent.id}>
              <div><p className="eyebrow">{codeLabel(intent.status, locale)}</p><h3>{title(intent.graves, locale)}</h3><p>{intent.review_reason ? reasonLabel(intent.review_reason, locale) : (locale === "ja" ? "決済事業者の状態を照合する必要があります。" : "Provider status needs reconciliation.")}</p></div>
              <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void reconcile(intent.id)}>{locale === "ja" ? "今すぐ照合" : "Reconcile now"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>{locale === "ja" ? "有効な利用権" : "Active entitlements"} · {codeLabel(data.paymentMode, locale)}</h2>
        {!data.activeEntitlements.length ? <div className="empty-state">{locale === "ja" ? "有効な利用権はありません。" : "No active entitlements."}</div> : null}
        <div className="admin-list">
          {data.activeEntitlements.map((entitlement) => (
            <article className="card admin-row" key={`${entitlement.grave_id}:${entitlement.mode}`}>
              <div><h3>{title(entitlement.graves, locale)}</h3><p>{entitlement.reason ? reasonLabel(entitlement.reason, locale) : (locale === "ja" ? "有効な有料利用権です。" : "Active paid entitlement.")}</p></div>
              <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(entitlement.grave_id, "suspend_entitlement", entitlement.mode)}>{locale === "ja" ? "利用権を停止" : "Suspend entitlement"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>{locale === "ja" ? "停止中の利用権" : "Suspended entitlements"}</h2>
        {!data.suspendedEntitlements.length ? <div className="empty-state">{locale === "ja" ? "停止中の利用権はありません。" : "No suspended entitlements."}</div> : null}
        <div className="admin-list">
          {data.suspendedEntitlements.map((entitlement) => (
            <article className="card admin-row" key={`${entitlement.grave_id}:${entitlement.mode}`}>
              <div><h3>{title(entitlement.graves, locale)}</h3><p>{entitlement.reason ? reasonLabel(entitlement.reason, locale) : (locale === "ja" ? "理由の記録はありません。" : "No reason recorded.")}</p></div>
              <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void moderate(entitlement.grave_id, "restore_entitlement", entitlement.mode)}>{locale === "ja" ? "利用権を復元" : "Restore entitlement"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>{locale === "ja" ? "監査ログ" : "Audit log"}</h2>
        <div className="audit-table">
          {data.auditLog.map((entry) => <div key={entry.id}><span>{codeLabel(entry.action, locale)}</span><span>{entry.reason}</span><time>{formatDate(entry.created_at, { dateStyle: "medium", timeStyle: "short" })}</time></div>)}
        </div>
      </section>
    </section>
  );
}
