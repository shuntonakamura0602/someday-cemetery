import "server-only";

import { webhooks } from "@polar-sh/sdk/2026-10";

import { getPaymentConfig, requireReconciliationConfig } from "./config";
import { reconcileProviderOrder } from "./service";
import { getPaymentStore } from "./store";
import { PaymentError } from "./types";

export type WebhookResult =
  | { received: true; duplicate?: true; ignored?: true }
  | { received: true; queued: true };

function orderIdFromEvent(event: { type: string; data: unknown }): string | null {
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  if (event.type.startsWith("order.")) return typeof data.id === "string" ? data.id : null;
  if (event.type.startsWith("refund.")) return typeof data.order_id === "string" ? data.order_id : null;
  return null;
}

export async function receivePolarWebhook(request: Request): Promise<WebhookResult> {
  const config = getPaymentConfig();
  if (!config.webhookSecret) {
    throw new PaymentError(503, "WEBHOOK_NOT_CONFIGURED", "The payment webhook is not configured.");
  }
  const rawBody = await request.text();
  const signatureHeaders = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };
  const event = await webhooks.validateEvent(rawBody, signatureHeaders, config.webhookSecret);
  const orderId = orderIdFromEvent(event);
  const store = getPaymentStore();
  const persisted = await store.persistWebhook({
    mode: config.entitlementMode,
    eventId: signatureHeaders["webhook-id"],
    type: event.type,
    providerOrderId: orderId,
  });
  const token = crypto.randomUUID();
  const claimed = await store.claimWebhook(config.entitlementMode, persisted.rowId, token);
  if (!claimed) return { received: true, duplicate: true };

  if (!orderId) {
    await store.finishWebhook(config.entitlementMode, persisted.rowId, token, "processed");
    return { received: true, ignored: true };
  }

  try {
    requireReconciliationConfig(config);
    await reconcileProviderOrder(orderId);
    await store.finishWebhook(config.entitlementMode, persisted.rowId, token, "processed");
    return { received: true };
  } catch {
    await store.finishWebhook(
      config.entitlementMode,
      persisted.rowId,
      token,
      "failed",
      "ORDER_RECONCILIATION_FAILED",
    );
    return { received: true, queued: true };
  }
}

export { webhooks as polarWebhookSdk };
