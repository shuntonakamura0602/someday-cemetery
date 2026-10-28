import { describe, expect, it } from "vitest";

import { evaluateOrder } from "../../src/server/payments/state";
import type {
  GraveEntitlement,
  OrderEvaluationContext,
  ProviderOrderSnapshot,
} from "../../src/server/payments/types";

const order: ProviderOrderSnapshot = {
  id: "order-1",
  checkoutId: "checkout-1",
  status: "paid",
  paid: true,
  subtotalAmount: 700,
  discountAmount: 0,
  netAmount: 700,
  totalAmount: 756,
  refundedAmount: 0,
  currency: "usd",
  productId: "product-1",
  organizationId: "organization-1",
  metadata: { purchase_intent_id: "intent-1", grave_id: "grave-1" },
  modifiedAt: "2026-10-28T00:00:00Z",
};

const context: OrderEvaluationContext = {
  expectedProductId: "product-1",
  intentId: "intent-1",
  graveId: "grave-1",
  graveStatus: "published",
  existingEntitlement: null,
};

describe("evaluateOrder", () => {
  it("activates only a verified paid order with the fixed tax-exclusive amount", () => {
    expect(evaluateOrder(order, context)).toEqual({
      intentStatus: "paid",
      entitlementStatus: "active",
      needsReview: false,
      reviewReason: null,
    });
  });

  it.each([
    [{ productId: "attacker-product" }, "ORDER_TERMS_MISMATCH"],
    [{ currency: "eur" }, "ORDER_TERMS_MISMATCH"],
    [{ subtotalAmount: 1 }, "ORDER_TERMS_MISMATCH"],
    [{ discountAmount: 100, netAmount: 600 }, "ORDER_TERMS_MISMATCH"],
    [{ metadata: { purchase_intent_id: "other", grave_id: "grave-1" } }, "ORDER_METADATA_MISMATCH"],
  ] as const)("requires review for altered commercial terms or binding: %j", (change, reason) => {
    expect(evaluateOrder({ ...order, ...change }, context)).toMatchObject({
      intentStatus: "review_required",
      entitlementStatus: null,
      needsReview: true,
      reviewReason: reason,
    });
  });

  it("revokes after a full refund and cannot be reactivated by an old paid snapshot", () => {
    expect(
      evaluateOrder(
        { ...order, status: "refunded", refundedAmount: 700 },
        {
          ...context,
          existingEntitlement: entitlement("active", "order-1"),
        },
      ),
    ).toMatchObject({ entitlementStatus: "revoked", reviewReason: "ORDER_FULLY_REFUNDED" });

    expect(
      evaluateOrder(order, {
        ...context,
        existingEntitlement: entitlement("revoked", "order-1"),
      }),
    ).toMatchObject({ entitlementStatus: "revoked", reviewReason: "REFUND_STATE_PRESERVED" });
  });

  it("keeps the entitlement but flags a partial refund for review", () => {
    expect(
      evaluateOrder(
        { ...order, status: "partially_refunded", refundedAmount: 200 },
        { ...context, existingEntitlement: entitlement("active", "order-1") },
      ),
    ).toMatchObject({
      entitlementStatus: "active",
      needsReview: true,
      reviewReason: "ORDER_PARTIALLY_REFUNDED",
    });
  });

  it("never clears a manual suspension during normal synchronization", () => {
    expect(
      evaluateOrder(order, {
        ...context,
        existingEntitlement: entitlement("suspended", "order-1"),
      }),
    ).toMatchObject({
      intentStatus: "review_required",
      entitlementStatus: "suspended",
      reviewReason: "ENTITLEMENT_MANUALLY_SUSPENDED",
    });
  });

  it("does not fulfill a new payment for a hidden or deleted grave", () => {
    expect(evaluateOrder(order, { ...context, graveStatus: "hidden" })).toMatchObject({
      entitlementStatus: null,
      reviewReason: "HIDDEN_GRAVE_PAID_BEFORE_FULFILLMENT",
    });
    expect(evaluateOrder(order, { ...context, graveStatus: "deleted" })).toMatchObject({
      entitlementStatus: null,
      reviewReason: "GRAVE_DELETED_BEFORE_FULFILLMENT",
    });
  });

  it("keeps one entitlement and marks a second paid order for refund review", () => {
    expect(
      evaluateOrder(order, {
        ...context,
        existingEntitlement: entitlement("active", "different-order"),
      }),
    ).toMatchObject({
      entitlementStatus: "active",
      needsReview: true,
      reviewReason: "DUPLICATE_PAID_ORDER",
    });
  });
});

function entitlement(status: GraveEntitlement["status"], sourceOrderId: string): GraveEntitlement {
  return {
    graveId: "grave-1",
    mode: "sandbox",
    sourceOrderId,
    status,
    reason: null,
  };
}
