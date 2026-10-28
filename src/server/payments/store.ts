import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  PaymentError,
  type GraveEntitlement,
  type MinimalPurchaseState,
  type OrderDecision,
  type OwnedGrave,
  type PaymentOrderJob,
  type ProviderMode,
  type ProviderOrderSnapshot,
  type PurchaseIntent,
  type WebhookRecordInput,
  type WebhookPersistenceResult,
} from "./types";

type Row = Record<string, unknown>;

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new PaymentError(503, "DATABASE_NOT_CONFIGURED", "The shared database is not configured.");
  }
  adminClient = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}

function mapIntent(row: Row): PurchaseIntent {
  return {
    id: String(row.id),
    graveId: String(row.grave_id),
    ownerAtCreation: String(row.owner_at_creation),
    mode: row.mode as ProviderMode,
    status: row.status as PurchaseIntent["status"],
    providerCheckoutId: typeof row.provider_checkout_id === "string" ? row.provider_checkout_id : null,
    checkoutUrl: typeof row.checkout_url === "string" ? row.checkout_url : null,
    providerOrderId: typeof row.provider_order_id === "string" ? row.provider_order_id : null,
    reconcileToken: typeof row.reconcile_token === "string" ? row.reconcile_token : null,
  };
}

function mapEntitlement(row: Row | null): GraveEntitlement | null {
  if (!row) return null;
  return {
    graveId: String(row.grave_id),
    mode: row.mode as ProviderMode,
    sourceOrderId: String(row.source_order_id),
    status: row.status as GraveEntitlement["status"],
    reason: typeof row.reason === "string" ? row.reason : null,
  };
}

function throwDatabase(error: { message: string; code?: string } | null, message: string): never {
  throw new PaymentError(503, "DATABASE_ERROR", error?.code ? message : `${message} Please try again.`);
}

export class PaymentStore {
  constructor(private readonly db: SupabaseClient = getAdminClient()) {}

  async consumeRateLimit(
    action: string,
    subjectHash: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const { data, error } = await this.db.rpc("consume_rate_limit", {
      p_action: action,
      p_subject_hash: subjectHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throwDatabase(error, "Could not check the request limit.");
    if (!data) {
      throw new PaymentError(429, "RATE_LIMITED", "Please wait a little before trying again.", windowSeconds);
    }
  }

  async getOwnedGrave(graveId: string, ownerUserId: string): Promise<OwnedGrave | null> {
    const { data, error } = await this.db
      .from("graves")
      .select("id,owner_user_id,status,is_example")
      .eq("id", graveId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not verify the grave owner.");
    if (!data) return null;
    return {
      id: String(data.id),
      ownerUserId: typeof data.owner_user_id === "string" ? data.owner_user_id : null,
      status: data.status as OwnedGrave["status"],
      isExample: Boolean(data.is_example),
    };
  }

  async getGrave(graveId: string): Promise<OwnedGrave | null> {
    const { data, error } = await this.db
      .from("graves")
      .select("id,owner_user_id,status,is_example")
      .eq("id", graveId)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not read the grave.");
    if (!data) return null;
    return {
      id: String(data.id),
      ownerUserId: typeof data.owner_user_id === "string" ? data.owner_user_id : null,
      status: data.status as OwnedGrave["status"],
      isExample: Boolean(data.is_example),
    };
  }

  async getEntitlement(graveId: string, mode: ProviderMode): Promise<GraveEntitlement | null> {
    const { data, error } = await this.db
      .from("grave_entitlements")
      .select("grave_id,mode,source_order_id,status,reason")
      .eq("grave_id", graveId)
      .eq("mode", mode)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not read the entitlement.");
    const entitlement = mapEntitlement(data as Row | null);
    if (!entitlement || !data) return entitlement;
    const { data: order, error: orderError } = await this.db
      .from("payment_orders")
      .select("provider_order_id")
      .eq("id", String(data.source_order_id))
      .maybeSingle();
    if (orderError) throwDatabase(orderError, "Could not read the entitlement source.");
    if (order?.provider_order_id) entitlement.sourceOrderId = String(order.provider_order_id);
    return entitlement;
  }

  async getOpenIntent(graveId: string, mode: ProviderMode): Promise<PurchaseIntent | null> {
    const { data, error } = await this.db
      .from("purchase_intents")
      .select("*")
      .eq("grave_id", graveId)
      .eq("mode", mode)
      .in("status", ["creating", "checkout_open", "unknown", "review_required"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not read the purchase state.");
    return data ? mapIntent(data as Row) : null;
  }

  async createIntent(graveId: string, ownerUserId: string, mode: ProviderMode): Promise<PurchaseIntent> {
    const { data, error } = await this.db.rpc("begin_purchase_intent", {
      p_grave_id: graveId,
      p_owner_user_id: ownerUserId,
      p_mode: mode,
    });
    if (error?.message.includes("ALREADY_ENTITLED")) {
      throw new PaymentError(409, "ALREADY_ENTITLED", "This grave already has custom designs.");
    }
    if (error?.message.includes("PURCHASE_REVIEW_REQUIRED")) {
      throw new PaymentError(
        409,
        "PURCHASE_REVIEW_REQUIRED",
        "A previous checkout must be checked before another purchase can start.",
      );
    }
    if (error?.message.includes("FORBIDDEN")) {
      throw new PaymentError(403, "FORBIDDEN", "You do not own this grave.");
    }
    if (error) throwDatabase(error, "Could not start the purchase.");
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.intent_id) throw new PaymentError(503, "DATABASE_ERROR", "Could not start the purchase.");
    const intent = await this.getIntent(String(result.intent_id));
    if (!intent) throw new PaymentError(503, "DATABASE_ERROR", "Could not read the new purchase.");
    intent.reused = Boolean(result.reused);
    return intent;
  }

  async getIntent(intentId: string): Promise<PurchaseIntent | null> {
    const { data, error } = await this.db
      .from("purchase_intents")
      .select("*")
      .eq("id", intentId)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not read the purchase.");
    return data ? mapIntent(data as Row) : null;
  }

  async getOwnedIntent(intentId: string, ownerUserId: string): Promise<PurchaseIntent | null> {
    const { data, error } = await this.db
      .from("purchase_intents")
      .select("*")
      .eq("id", intentId)
      .eq("owner_at_creation", ownerUserId)
      .maybeSingle();
    if (error) throwDatabase(error, "Could not read the purchase.");
    return data ? mapIntent(data as Row) : null;
  }

  async markCheckoutOpen(
    intentId: string,
    ownerUserId: string,
    checkoutId: string,
    checkoutUrl: string,
  ): Promise<void> {
    const { error } = await this.db.rpc("finish_checkout_creation", {
      p_intent_id: intentId,
      p_owner_user_id: ownerUserId,
      p_provider_checkout_id: checkoutId,
      p_checkout_url: checkoutUrl,
      p_status: "checkout_open",
      p_error_code: null,
    });
    if (error) throwDatabase(error, "Could not save the checkout.");
  }

  async markIntentUnknown(intentId: string, ownerUserId: string, reason: string): Promise<void> {
    const { error } = await this.db.rpc("finish_checkout_creation", {
      p_intent_id: intentId,
      p_owner_user_id: ownerUserId,
      p_provider_checkout_id: null,
      p_checkout_url: null,
      p_status: "unknown",
      p_error_code: reason,
    });
    if (error) throwDatabase(error, "Could not save the uncertain checkout state.");
  }

  async markIntentReview(intentId: string, reason: string): Promise<void> {
    const { error } = await this.db
      .from("purchase_intents")
      .update({ status: "review_required", review_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", intentId);
    if (error) throwDatabase(error, "Could not save the payment review state.");
  }

  async getMinimalPurchaseState(
    intent: PurchaseIntent,
    entitlement: GraveEntitlement | null,
  ): Promise<MinimalPurchaseState> {
    return {
      intentId: intent.id,
      graveId: intent.graveId,
      status: intent.status,
      entitlement: entitlement?.status ?? "none",
    };
  }

  async persistWebhook(input: WebhookRecordInput): Promise<WebhookPersistenceResult> {
    const { data, error } = await this.db.from("webhook_events").insert({
      mode: input.mode,
      provider_event_id: input.eventId,
      type: input.type,
      provider_order_id: input.providerOrderId,
      processing_status: "received",
      attempts: 0,
    }).select("id").single();
    if (!error && data) return { rowId: String(data.id), replayed: false };
    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await this.db
        .from("webhook_events")
        .select("id")
        .eq("mode", input.mode)
        .eq("provider_event_id", input.eventId)
        .single();
      if (existingError || !existing) throwDatabase(existingError, "Could not read the replayed event.");
      return { rowId: String(existing.id), replayed: true };
    }
    throwDatabase(error, "Could not persist the payment event.");
  }

  async claimWebhook(mode: ProviderMode, eventRowId: string, token: string): Promise<boolean> {
    const { data, error } = await this.db.rpc("claim_webhook_event", {
      p_mode: mode,
      p_event_id: eventRowId,
      p_token: token,
      p_lease_seconds: 60,
    });
    if (error) throwDatabase(error, "Could not claim the payment event.");
    return Boolean(data);
  }

  async finishWebhook(
    mode: ProviderMode,
    eventRowId: string,
    token: string,
    status: "processed" | "failed",
    lastErrorCode: string | null = null,
  ): Promise<void> {
    const { error } = await this.db
      .from("webhook_events")
      .update({
        processing_status: status,
        processed_at: status === "processed" ? new Date().toISOString() : null,
        lease_until: null,
        processing_token: null,
        last_error_code: lastErrorCode,
      })
      .eq("mode", mode)
      .eq("id", eventRowId)
      .eq("processing_token", token);
    if (error) throwDatabase(error, "Could not finish the payment event.");
  }

  async claimIntent(intentId: string, mode: ProviderMode, token: string): Promise<PurchaseIntent | null> {
    const { data, error } = await this.db.rpc("claim_purchase_intent_reconciliation", {
      p_intent_id: intentId,
      p_mode: mode,
      p_token: token,
      p_lease_seconds: 60,
    });
    if (error) throwDatabase(error, "Could not claim the purchase for checking.");
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapIntent(row as Row) : null;
  }

  async claimReconciliationJobs(mode: ProviderMode, token: string, limit: number): Promise<PurchaseIntent[]> {
    const { data, error } = await this.db.rpc("claim_payment_reconciliation_jobs", {
      p_mode: mode,
      p_token: token,
      p_limit: Math.min(Math.max(limit, 1), 50),
      p_lease_seconds: 60,
    });
    if (error) throwDatabase(error, "Could not claim payment reconciliation work.");
    return Array.isArray(data) ? data.map((row) => mapIntent(row as Row)) : [];
  }

  async claimOrderReconciliationJobs(
    mode: ProviderMode,
    token: string,
    limit: number,
  ): Promise<PaymentOrderJob[]> {
    const { data, error } = await this.db.rpc("claim_payment_order_reconciliation_jobs", {
      p_mode: mode,
      p_token: token,
      p_limit: Math.min(Math.max(limit, 1), 50),
      p_lease_seconds: 60,
    });
    if (error) throwDatabase(error, "Could not claim order reconciliation work.");
    return Array.isArray(data)
      ? data.map((row: Row) => ({
          id: String(row.id),
          mode: row.mode as ProviderMode,
          providerOrderId: String(row.provider_order_id),
          purchaseIntentId: String(row.purchase_intent_id),
          reconcileToken: token,
        }))
      : [];
  }

  async releaseOrderLease(orderId: string, token: string, lastErrorCode: string | null): Promise<void> {
    const { error } = await this.db
      .from("payment_orders")
      .update({
        reconcile_token: null,
        reconcile_lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("reconcile_token", token);
    if (error) throwDatabase(error, "Could not release order reconciliation work.");
    void lastErrorCode;
  }

  async releaseIntentLease(intentId: string, token: string, lastErrorCode: string | null): Promise<void> {
    const { error } = await this.db
      .from("purchase_intents")
      .update({
        reconcile_token: null,
        reconcile_lease_until: null,
        last_error_code: lastErrorCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intentId)
      .eq("reconcile_token", token);
    if (error) throwDatabase(error, "Could not release payment reconciliation work.");
  }

  async finishIntentWithoutOrder(
    intentId: string,
    token: string | null,
    status: "expired" | "failed" | "unknown" | "review_required",
    reason: string | null,
  ): Promise<void> {
    const { error } = await this.db
      .from("purchase_intents")
      .update({
        status,
        review_reason: status === "review_required" ? reason : null,
        last_error_code: status === "review_required" ? null : reason,
        reconcile_token: null,
        reconcile_lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intentId)
      .eq("reconcile_token", token);
    if (error) throwDatabase(error, "Could not finish payment reconciliation work.");
  }

  async applyOrderSnapshot(
    intent: PurchaseIntent,
    token: string | null,
    order: ProviderOrderSnapshot,
    decision: OrderDecision,
    orderReconcileToken: string | null = null,
  ): Promise<void> {
    const { error } = await this.db.rpc("apply_payment_order_state", {
      p_intent_id: intent.id,
      p_mode: intent.mode,
      p_reconcile_token: token,
      p_order_reconcile_token: orderReconcileToken,
      p_provider_order_id: order.id,
      p_provider_product_id: order.productId,
      p_provider_organization_id: order.organizationId,
      p_provider_status: order.status,
      p_subtotal_amount: order.subtotalAmount,
      p_discount_amount: order.discountAmount,
      p_net_amount: order.netAmount,
      p_total_amount: order.totalAmount,
      p_refunded_amount: order.refundedAmount,
      p_currency: order.currency.toUpperCase(),
      p_provider_modified_at: order.modifiedAt,
      p_intent_status: decision.intentStatus,
      p_entitlement_status: decision.entitlementStatus,
      p_needs_review: decision.needsReview,
      p_review_reason: decision.reviewReason,
    });
    if (error) throwDatabase(error, "Could not apply the verified payment state.");
  }
}

let store: PaymentStore | null = null;

export function getPaymentStore(): PaymentStore {
  store ??= new PaymentStore();
  return store;
}
