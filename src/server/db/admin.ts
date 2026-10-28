import "server-only";

import { ApiError } from "@/server/api-errors";
import { mapDatabaseError } from "@/server/db/graves";
import { getServerEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export async function getAdminDashboard() {
  const db = getSupabaseAdminClient();
  const paymentMode = getServerEnv().entitlementMode;
  const [reports, hidden, intents, activeEntitlements, suspendedEntitlements, logs] = await Promise.all([
    db.from("reports").select("id,grave_id,reason,details,status,created_at,graves(title,status)").eq("status", "open").order("created_at").limit(100),
    db.from("graves").select("id,title,status,updated_at").eq("status", "hidden").order("updated_at", { ascending: false }).limit(100),
    db.from("purchase_intents").select("id,grave_id,mode,status,review_reason,updated_at,graves(title,status)").eq("mode", paymentMode).in("status", ["unknown", "review_required"]).order("updated_at").limit(100),
    db.from("grave_entitlements").select("grave_id,mode,status,reason,updated_at,graves(title,status)").eq("mode", paymentMode).eq("status", "active").order("updated_at", { ascending: false }).limit(100),
    db.from("grave_entitlements").select("grave_id,mode,status,reason,updated_at,graves(title,status)").eq("mode", paymentMode).eq("status", "suspended").order("updated_at", { ascending: false }).limit(100),
    db.from("moderation_log").select("id,admin_user_id,grave_id,action,reason,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const failed = [reports, hidden, intents, activeEntitlements, suspendedEntitlements, logs].find((result) => result.error);
  if (failed?.error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The moderation queue could not be loaded.");
  return {
    reports: reports.data ?? [],
    hiddenGraves: hidden.data ?? [],
    paymentReviews: intents.data ?? [],
    activeEntitlements: activeEntitlements.data ?? [],
    suspendedEntitlements: suspendedEntitlements.data ?? [],
    auditLog: logs.data ?? [],
    paymentMode,
  };
}

export async function moderateGrave(
  adminUserId: string,
  graveId: string,
  action: "hide" | "republish" | "delete" | "suspend_entitlement" | "restore_entitlement",
  reason: string,
  mode?: "sandbox" | "live",
) {
  const { data, error } = await getSupabaseAdminClient().rpc("moderate_grave", {
    p_admin_user_id: adminUserId,
    p_grave_id: graveId,
    p_action: action,
    p_reason: reason,
    p_mode: mode ?? null,
  });
  if (error) mapDatabaseError(error);
  return data;
}

export async function moderateReport(
  adminUserId: string,
  reportId: string,
  action: "resolve_report" | "dismiss_report",
  reason: string,
) {
  const { data, error } = await getSupabaseAdminClient().rpc("moderate_report", {
    p_admin_user_id: adminUserId,
    p_report_id: reportId,
    p_action: action,
    p_reason: reason,
  });
  if (error) mapDatabaseError(error);
  return data;
}

export async function recordPaymentReconciliation(
  adminUserId: string,
  intentId: string,
  reason: string,
) {
  const db = getSupabaseAdminClient();
  const { data: intent, error: intentError } = await db
    .from("purchase_intents")
    .select("grave_id,mode")
    .eq("id", intentId)
    .eq("mode", getServerEnv().entitlementMode)
    .maybeSingle();
  if (intentError || !intent) {
    throw new ApiError(404, "PURCHASE_NOT_FOUND", "The purchase could not be found.");
  }
  const { error } = await db.from("moderation_log").insert({
    admin_user_id: adminUserId,
    grave_id: intent.grave_id,
    action: "reconcile_payment",
    reason,
  });
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The reconciliation audit record could not be saved.");
}
