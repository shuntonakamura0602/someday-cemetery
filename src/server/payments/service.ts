import "server-only";

import type { Polar } from "@polar-sh/sdk/2026-10";

import { getPolarClient } from "./client";
import {
  getPaymentConfig,
  requireReconciliationConfig,
  requireSalesConfig,
} from "./config";
import { evaluateOrder } from "./state";
import { getPaymentStore, type PaymentStore } from "./store";
import {
  PRODUCT_AMOUNT,
  PRODUCT_CURRENCY,
  PaymentError,
  type MinimalPurchaseState,
  type PaymentConfig,
  type ProviderMode,
  type ProviderOrderSnapshot,
  type PurchaseIntent,
} from "./types";

type CheckoutCreate = Parameters<Polar["checkouts"]["create"]>[0];
type PolarOrder = Awaited<ReturnType<Polar["orders"]["get"]>>;

interface ServiceDependencies {
  config: PaymentConfig;
  store: PaymentStore;
  polar?: Polar;
}

function dependencies(): ServiceDependencies {
  const config = getPaymentConfig();
  return { config, store: getPaymentStore() };
}

function polarFor(deps: ServiceDependencies): Polar {
  requireReconciliationConfig(deps.config);
  return deps.polar ?? getPolarClient(deps.config);
}

export function buildCheckoutRequest(
  config: PaymentConfig & { productId: string },
  intent: PurchaseIntent,
): CheckoutCreate {
  return {
    products: [config.productId],
    allow_discount_codes: false,
    allow_trial: false,
    currency: PRODUCT_CURRENCY,
    locale: "en",
    metadata: {
      purchase_intent_id: intent.id,
      grave_id: intent.graveId,
    },
    success_url: `${config.appBaseUrl}/checkout/result?intent=${encodeURIComponent(intent.id)}&checkout_id={CHECKOUT_ID}`,
    return_url: `${config.appBaseUrl}/g/${encodeURIComponent(intent.graveId)}/customize?checkout=cancelled`,
  };
}

export function normalizePolarOrder(order: PolarOrder): ProviderOrderSnapshot {
  return {
    id: order.id,
    checkoutId: order.checkout_id,
    status: order.status,
    paid: order.paid,
    subtotalAmount: order.subtotal_amount,
    discountAmount: order.discount_amount,
    netAmount: order.net_amount,
    totalAmount: order.total_amount,
    refundedAmount: order.refunded_amount,
    currency: order.currency,
    productId: order.product_id,
    organizationId: order.product?.organization_id ?? null,
    metadata: order.metadata as Record<string, unknown>,
    modifiedAt: order.modified_at,
  };
}

function verifyCreatedCheckout(
  checkout: Awaited<ReturnType<Polar["checkouts"]["create"]>>,
  productId: string,
): boolean {
  return (
    checkout.product_id === productId &&
    checkout.amount === PRODUCT_AMOUNT &&
    checkout.net_amount === PRODUCT_AMOUNT &&
    checkout.discount_amount === 0 &&
    checkout.currency.toLowerCase() === PRODUCT_CURRENCY &&
    checkout.allow_discount_codes === false &&
    checkout.url.startsWith("https://")
  );
}

export type CheckoutStartResult =
  | { kind: "checkout"; intentId: string; checkoutUrl: string; reused: boolean }
  | { kind: "already_active"; intentId: string | null; checkoutUrl: null; reused: false };

export async function startCheckout(
  graveId: string,
  ownerUserId: string,
  supplied?: ServiceDependencies,
): Promise<CheckoutStartResult> {
  const deps = supplied ?? dependencies();
  requireSalesConfig(deps.config);
  if (deps.config.dataBackend !== "supabase") {
    throw new PaymentError(503, "PAYMENTS_DISABLED", "Purchases are not available in the demo.");
  }

  const grave = await deps.store.getOwnedGrave(graveId, ownerUserId);
  if (!grave) throw new PaymentError(403, "FORBIDDEN", "You do not own this grave.");
  if (grave.isExample || grave.status !== "published") {
    throw new PaymentError(409, "PURCHASE_UNAVAILABLE", "This grave cannot be purchased for.");
  }

  const entitlement = await deps.store.getEntitlement(graveId, deps.config.entitlementMode);
  if (entitlement?.status === "active") {
    return { kind: "already_active", intentId: null, checkoutUrl: null, reused: false };
  }
  if (entitlement?.status === "suspended") {
    throw new PaymentError(
      409,
      "PURCHASE_REVIEW_REQUIRED",
      "This purchase needs support review before another checkout can start.",
    );
  }

  let intent = await deps.store.getOpenIntent(graveId, deps.config.entitlementMode);
  if (intent) {
    if (intent.ownerAtCreation !== ownerUserId) {
      throw new PaymentError(
        409,
        "PURCHASE_REVIEW_REQUIRED",
        "A previous checkout must be checked before another purchase can start.",
      );
    }
    if (intent.status === "checkout_open" && intent.checkoutUrl) {
      return { kind: "checkout", intentId: intent.id, checkoutUrl: intent.checkoutUrl, reused: true };
    }
    throw new PaymentError(
      409,
      "PURCHASE_REVIEW_REQUIRED",
      "Your earlier checkout is being checked. Please use Check again.",
    );
  }

  intent = await deps.store.createIntent(graveId, ownerUserId, deps.config.entitlementMode);
  if (intent.ownerAtCreation !== ownerUserId) {
    throw new PaymentError(
      409,
      "PURCHASE_REVIEW_REQUIRED",
      "A previous checkout must be checked before another purchase can start.",
    );
  }
  if (intent.reused) {
    if (intent.status === "checkout_open" && intent.checkoutUrl) {
      return { kind: "checkout", intentId: intent.id, checkoutUrl: intent.checkoutUrl, reused: true };
    }
    throw new PaymentError(
      409,
      "PURCHASE_REVIEW_REQUIRED",
      "Your earlier checkout is being prepared or checked. Please use Check again.",
    );
  }
  if (intent.status !== "creating") {
    throw new PaymentError(409, "PURCHASE_REVIEW_REQUIRED", "The checkout state needs support review.");
  }

  try {
    const polar = deps.polar ?? getPolarClient(deps.config);
    const checkout = await polar.checkouts.create(buildCheckoutRequest(deps.config, intent));
    if (!verifyCreatedCheckout(checkout, deps.config.productId)) {
      await deps.store.markIntentReview(intent.id, "CHECKOUT_TERMS_MISMATCH");
      throw new PaymentError(
        409,
        "PURCHASE_REVIEW_REQUIRED",
        "The checkout configuration needs support review.",
      );
    }
    await deps.store.markCheckoutOpen(intent.id, ownerUserId, checkout.id, checkout.url);
    return { kind: "checkout", intentId: intent.id, checkoutUrl: checkout.url, reused: false };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    try {
      await deps.store.markIntentUnknown(intent.id, ownerUserId, "CHECKOUT_CREATE_UNCERTAIN");
    } catch {
      // Ownership may have changed while Polar was creating the checkout. Never return its URL.
    }
    throw new PaymentError(
      503,
      "SERVICE_UNAVAILABLE",
      "The checkout could not be confirmed. Please use Check again before retrying.",
    );
  }
}

async function applyVerifiedOrder(
  order: PolarOrder,
  intent: PurchaseIntent,
  token: string | null,
  deps: ServiceDependencies,
  orderReconcileToken: string | null = null,
): Promise<void> {
  const grave = await deps.store.getGrave(intent.graveId);
  if (!grave) {
    if (token) {
      await deps.store.finishIntentWithoutOrder(intent.id, token, "review_required", "GRAVE_NOT_FOUND");
    } else {
      throw new PaymentError(409, "PURCHASE_REVIEW_REQUIRED", "The order's grave could not be found.");
    }
    return;
  }
  const entitlement = await deps.store.getEntitlement(intent.graveId, intent.mode);
  const snapshot = normalizePolarOrder(order);
  const decision = evaluateOrder(snapshot, {
    expectedProductId: deps.config.productId!,
    intentId: intent.id,
    graveId: intent.graveId,
    graveStatus: grave.status,
    existingEntitlement: entitlement,
  });
  await deps.store.applyOrderSnapshot(intent, token, snapshot, decision, orderReconcileToken);
}

async function reconcileClaimedIntent(
  intent: PurchaseIntent,
  token: string,
  deps: ServiceDependencies,
): Promise<void> {
  const polar = polarFor(deps);
  try {
    if (intent.providerOrderId) {
      await applyVerifiedOrder(await polar.orders.get(intent.providerOrderId), intent, token, deps);
      return;
    }
    if (!intent.providerCheckoutId) {
      await deps.store.finishIntentWithoutOrder(intent.id, token, "unknown", "CHECKOUT_ID_MISSING");
      return;
    }

    const checkout = await polar.checkouts.get(intent.providerCheckoutId);
    if (checkout.status === "expired" || checkout.status === "failed") {
      await deps.store.finishIntentWithoutOrder(intent.id, token, checkout.status, `CHECKOUT_${checkout.status.toUpperCase()}`);
      return;
    }
    if (checkout.status !== "succeeded") {
      await deps.store.releaseIntentLease(intent.id, token, null);
      return;
    }

    const orders = await polar.orders.list({ checkout_id: checkout.id, limit: 10 });
    if (orders.items.length === 0) {
      await deps.store.finishIntentWithoutOrder(intent.id, token, "unknown", "SUCCEEDED_CHECKOUT_WITHOUT_ORDER");
      return;
    }
    if (orders.items.length > 1) {
      await deps.store.finishIntentWithoutOrder(intent.id, token, "review_required", "MULTIPLE_ORDERS_FOR_CHECKOUT");
      return;
    }
    await applyVerifiedOrder(orders.items[0], intent, token, deps);
  } catch (error) {
    await deps.store.releaseIntentLease(intent.id, token, "PROVIDER_RECONCILIATION_FAILED");
    throw error;
  }
}

export async function reconcileIntent(
  intentId: string,
  supplied?: ServiceDependencies,
): Promise<MinimalPurchaseState> {
  const deps = supplied ?? dependencies();
  requireReconciliationConfig(deps.config);
  const token = crypto.randomUUID();
  const intent = await deps.store.claimIntent(intentId, deps.config.entitlementMode, token);
  if (intent) await reconcileClaimedIntent(intent, token, deps);

  const current = await deps.store.getIntent(intentId);
  if (!current || current.mode !== deps.config.entitlementMode) {
    throw new PaymentError(404, "PURCHASE_NOT_FOUND", "The purchase could not be found.");
  }
  const entitlement = await deps.store.getEntitlement(current.graveId, current.mode);
  return deps.store.getMinimalPurchaseState(current, entitlement);
}

export async function reconcileProviderOrder(
  providerOrderId: string,
  supplied?: ServiceDependencies,
): Promise<void> {
  const deps = supplied ?? dependencies();
  requireReconciliationConfig(deps.config);
  const polar = polarFor(deps);
  const order = await polar.orders.get(providerOrderId);
  const metadata = order.metadata as Record<string, unknown>;
  const intentId = metadata.purchase_intent_id;
  if (typeof intentId !== "string") {
    if (order.product_id === deps.config.productId) {
      throw new PaymentError(409, "PURCHASE_REVIEW_REQUIRED", "The paid order is missing its internal binding.");
    }
    return;
  }
  const token = crypto.randomUUID();
  let intent = await deps.store.claimIntent(intentId, deps.config.entitlementMode, token);
  if (!intent) {
    const current = await deps.store.getIntent(intentId);
    if (!current || current.mode !== deps.config.entitlementMode) return;
    if (["creating", "checkout_open", "unknown", "review_required"].includes(current.status)) return;
    intent = current;
  }
  try {
    await applyVerifiedOrder(order, intent, intent.reconcileToken === token ? token : null, deps);
  } catch (error) {
    if (intent.reconcileToken === token) {
      await deps.store.releaseIntentLease(intent.id, token, "PROVIDER_ORDER_PROCESSING_FAILED");
    }
    throw error;
  }
}

export async function runPaymentReconciliation(
  limit = 25,
  supplied?: ServiceDependencies,
): Promise<{ claimed: number; processed: number; failed: number }> {
  const deps = supplied ?? dependencies();
  requireReconciliationConfig(deps.config);
  const intentToken = crypto.randomUUID();
  const intents = await deps.store.claimReconciliationJobs(deps.config.entitlementMode, intentToken, limit);
  const orderToken = crypto.randomUUID();
  const orderJobs = await deps.store.claimOrderReconciliationJobs(
    deps.config.entitlementMode,
    orderToken,
    Math.max(1, limit - intents.length),
  );
  let processed = 0;
  let failed = 0;
  for (const intent of intents) {
    try {
      await reconcileClaimedIntent(intent, intentToken, deps);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  const polar = polarFor(deps);
  for (const job of orderJobs) {
    try {
      const intent = await deps.store.getIntent(job.purchaseIntentId);
      if (!intent || intent.mode !== job.mode) {
        await deps.store.releaseOrderLease(job.id, orderToken, "PURCHASE_INTENT_NOT_FOUND");
        failed += 1;
        continue;
      }
      const order = await polar.orders.get(job.providerOrderId);
      await applyVerifiedOrder(order, intent, null, deps, job.reconcileToken);
      processed += 1;
    } catch {
      await deps.store.releaseOrderLease(job.id, orderToken, "PROVIDER_ORDER_PROCESSING_FAILED");
      failed += 1;
    }
  }
  return { claimed: intents.length + orderJobs.length, processed, failed };
}

export function providerModeForWebhook(config: PaymentConfig): ProviderMode {
  return config.entitlementMode;
}
