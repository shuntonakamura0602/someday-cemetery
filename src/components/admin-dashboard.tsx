"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

function title(relation: Relation) {
  const value = Array.isArray(relation) ? relation[0] : relation;
  return value?.title || "Unavailable grave";
}

export function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const result = (await response.json()) as Dashboard & { message?: string };
    if (!response.ok) throw new Error(result.message ?? "The moderation queue could not be loaded.");
    setData(result);
    setError(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The operation did not complete.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The operation did not complete.");
    } finally {
      setBusy(null);
    }
  }

  function reasonFor(action: string) {
    return window.prompt(`Reason for ${action.replaceAll("_", " ")}:`)?.trim() || null;
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
        <p className="eyebrow">Operator access</p><h1>The garden office is locked.</h1><p className="lede">{error}</p>
        <Link className="button button-primary" href="/admin/sign-in">Administrator sign in</Link>
      </section>
    );
  }
  if (!data) return <div className="narrow-page state-page">Opening the garden office…</div>;

  return (
    <section className="wide-page admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">Garden office</p><h1>Moderation and payments.</h1></div>
        <button className="button button-secondary" type="button" onClick={() => void load()}>Refresh</button>
      </header>
      {error ? <p className="error-message" role="alert">{error}</p> : null}

      <div className="admin-summary">
        <div><strong>{data.reports.length}</strong><span>Open reports</span></div>
        <div><strong>{data.hiddenGraves.length}</strong><span>Hidden graves</span></div>
        <div><strong>{data.paymentReviews.length}</strong><span>Payment reviews</span></div>
        <div><strong>{data.activeEntitlements.length}</strong><span>Active rights</span></div>
        <div><strong>{data.suspendedEntitlements.length}</strong><span>Suspended rights</span></div>
      </div>

      <section className="admin-section">
        <h2>Open reports</h2>
        {!data.reports.length ? <div className="empty-state">No open reports.</div> : null}
        <div className="admin-list">
          {data.reports.map((item) => (
            <article className="card admin-row" key={item.id}>
              <div><p className="eyebrow">{item.reason.replaceAll("_", " ")}</p><h3>{title(item.graves)}</h3><p>{item.details || "No additional details."}</p><span className="tiny muted">{new Date(item.created_at).toLocaleString()}</span></div>
              <div className="actions">
                <Link className="button button-small button-secondary" href={`/g/${item.grave_id}`}>Inspect</Link>
                <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(item.grave_id, "hide")}>Hide grave</button>
                <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void report(item.id, "resolve_report")}>Resolve</button>
                <button className="button button-small button-ghost" type="button" disabled={Boolean(busy)} onClick={() => void report(item.id, "dismiss_report")}>Dismiss</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Hidden graves</h2>
        {!data.hiddenGraves.length ? <div className="empty-state">No hidden graves.</div> : null}
        <div className="admin-list">
          {data.hiddenGraves.map((grave) => (
            <article className="card admin-row" key={grave.id}>
              <div><h3>{grave.title}</h3><span className="tiny muted">Hidden {new Date(grave.updated_at).toLocaleString()}</span></div>
              <div className="actions">
                <button className="button button-small button-primary" type="button" disabled={Boolean(busy)} onClick={() => void moderate(grave.id, "republish")}>Republish</button>
                <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(grave.id, "delete")}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Payment review · {data.paymentMode}</h2>
        {!data.paymentReviews.length ? <div className="empty-state">No unresolved payment intents.</div> : null}
        <div className="admin-list">
          {data.paymentReviews.map((intent) => (
            <article className="card admin-row" key={intent.id}>
              <div><p className="eyebrow">{intent.status.replaceAll("_", " ")}</p><h3>{title(intent.graves)}</h3><p>{intent.review_reason || "Provider status needs reconciliation."}</p></div>
              <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void reconcile(intent.id)}>Reconcile now</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Active entitlements · {data.paymentMode}</h2>
        {!data.activeEntitlements.length ? <div className="empty-state">No active entitlements.</div> : null}
        <div className="admin-list">
          {data.activeEntitlements.map((entitlement) => (
            <article className="card admin-row" key={`${entitlement.grave_id}:${entitlement.mode}`}>
              <div><h3>{title(entitlement.graves)}</h3><p>{entitlement.reason || "Active paid entitlement."}</p></div>
              <button className="button button-small button-danger" type="button" disabled={Boolean(busy)} onClick={() => void moderate(entitlement.grave_id, "suspend_entitlement", entitlement.mode)}>Suspend entitlement</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Suspended entitlements</h2>
        {!data.suspendedEntitlements.length ? <div className="empty-state">No suspended entitlements.</div> : null}
        <div className="admin-list">
          {data.suspendedEntitlements.map((entitlement) => (
            <article className="card admin-row" key={`${entitlement.grave_id}:${entitlement.mode}`}>
              <div><h3>{title(entitlement.graves)}</h3><p>{entitlement.reason || "No reason recorded."}</p></div>
              <button className="button button-small button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void moderate(entitlement.grave_id, "restore_entitlement", entitlement.mode)}>Restore entitlement</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Audit log</h2>
        <div className="audit-table">
          {data.auditLog.map((entry) => <div key={entry.id}><span>{entry.action.replaceAll("_", " ")}</span><span>{entry.reason}</span><time>{new Date(entry.created_at).toLocaleString()}</time></div>)}
        </div>
      </section>
    </section>
  );
}
