import {
  PRODUCT_AMOUNT,
  PRODUCT_CURRENCY,
  type OrderDecision,
  type OrderEvaluationContext,
  type ProviderOrderSnapshot,
} from "./types";

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export function evaluateOrder(
  order: ProviderOrderSnapshot,
  context: OrderEvaluationContext,
): OrderDecision {
  const invalidCommercialTerms =
    order.productId !== context.expectedProductId ||
    order.currency.toLowerCase() !== PRODUCT_CURRENCY ||
    order.subtotalAmount !== PRODUCT_AMOUNT ||
    order.discountAmount !== 0 ||
    order.netAmount !== PRODUCT_AMOUNT;

  const invalidBinding =
    metadataString(order.metadata, "purchase_intent_id") !== context.intentId ||
    metadataString(order.metadata, "grave_id") !== context.graveId;

  if (invalidCommercialTerms || invalidBinding) {
    return {
      intentStatus: "review_required",
      entitlementStatus: null,
      needsReview: true,
      reviewReason: invalidBinding ? "ORDER_METADATA_MISMATCH" : "ORDER_TERMS_MISMATCH",
    };
  }

  if (context.graveStatus === "deleted") {
    return {
      intentStatus: "review_required",
      entitlementStatus: null,
      needsReview: true,
      reviewReason: "GRAVE_DELETED_BEFORE_FULFILLMENT",
    };
  }

  const fullyRefunded =
    order.status === "refunded" ||
    (order.netAmount > 0 && order.refundedAmount >= order.netAmount);
  if (fullyRefunded) {
    return {
      intentStatus: "paid",
      entitlementStatus: "revoked",
      needsReview: false,
      reviewReason: "ORDER_FULLY_REFUNDED",
    };
  }

  if (
    context.existingEntitlement?.status === "revoked" &&
    context.existingEntitlement.sourceOrderId === order.id
  ) {
    return {
      intentStatus: "paid",
      entitlementStatus: "revoked",
      needsReview: false,
      reviewReason: "REFUND_STATE_PRESERVED",
    };
  }

  if (!order.paid || (order.status !== "paid" && order.status !== "partially_refunded")) {
    return {
      intentStatus: order.status === "void" ? "failed" : "unknown",
      entitlementStatus: null,
      needsReview: false,
      reviewReason: null,
    };
  }

  if (context.existingEntitlement?.status === "suspended") {
    return {
      intentStatus: "review_required",
      entitlementStatus: "suspended",
      needsReview: true,
      reviewReason: "ENTITLEMENT_MANUALLY_SUSPENDED",
    };
  }

  if (
    context.existingEntitlement?.status === "active" &&
    context.existingEntitlement.sourceOrderId !== order.id
  ) {
    return {
      intentStatus: "review_required",
      entitlementStatus: "active",
      needsReview: true,
      reviewReason: "DUPLICATE_PAID_ORDER",
    };
  }

  if (context.graveStatus === "hidden" && !context.existingEntitlement) {
    return {
      intentStatus: "review_required",
      entitlementStatus: null,
      needsReview: true,
      reviewReason: "HIDDEN_GRAVE_PAID_BEFORE_FULFILLMENT",
    };
  }

  if (order.refundedAmount > 0 || order.status === "partially_refunded") {
    return {
      intentStatus: "paid",
      entitlementStatus: "active",
      needsReview: true,
      reviewReason: "ORDER_PARTIALLY_REFUNDED",
    };
  }

  return {
    intentStatus: "paid",
    entitlementStatus: "active",
    needsReview: false,
    reviewReason: null,
  };
}
