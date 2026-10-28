export const PRODUCT_SKU = "custom_headstone_v1" as const;
export const PRODUCT_AMOUNT = 700 as const;
export const PRODUCT_CURRENCY = "usd" as const;

export type AppStage = "local" | "preview" | "production";
export type PaymentMode = "off" | "sandbox" | "live";
export type ProviderMode = Exclude<PaymentMode, "off">;
export type PurchaseIntentStatus =
  | "creating"
  | "checkout_open"
  | "unknown"
  | "paid"
  | "expired"
  | "failed"
  | "review_required";
export type EntitlementStatus = "active" | "revoked" | "suspended";
export type GraveStatus = "published" | "hidden" | "deleted";

export interface PaymentConfig {
  appStage: AppStage;
  appBaseUrl: string;
  dataBackend: "demo" | "supabase";
  salesMode: PaymentMode;
  entitlementMode: ProviderMode;
  accessToken?: string;
  productId?: string;
  webhookSecret?: string;
  cronSecret?: string;
}

export interface OwnedGrave {
  id: string;
  ownerUserId: string | null;
  status: GraveStatus;
  isExample: boolean;
}

export interface PurchaseIntent {
  id: string;
  graveId: string;
  ownerAtCreation: string;
  mode: ProviderMode;
  status: PurchaseIntentStatus;
  providerCheckoutId: string | null;
  checkoutUrl: string | null;
  providerOrderId: string | null;
  reconcileToken?: string | null;
  reused?: boolean;
}

export interface GraveEntitlement {
  graveId: string;
  mode: ProviderMode;
  sourceOrderId: string;
  status: EntitlementStatus;
  reason: string | null;
}

export interface MinimalPurchaseState {
  intentId: string;
  graveId: string;
  status: PurchaseIntentStatus;
  entitlement: EntitlementStatus | "none";
}

/** A deliberately billing-data-free projection of a Polar order. */
export interface ProviderOrderSnapshot {
  id: string;
  checkoutId: string | null;
  status: string;
  paid: boolean;
  subtotalAmount: number;
  discountAmount: number;
  netAmount: number;
  totalAmount: number;
  refundedAmount: number;
  currency: string;
  productId: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown>;
  modifiedAt: string | null;
}

export interface OrderEvaluationContext {
  expectedProductId: string;
  intentId: string;
  graveId: string;
  graveStatus: GraveStatus;
  existingEntitlement: GraveEntitlement | null;
}

export interface OrderDecision {
  intentStatus: PurchaseIntentStatus;
  entitlementStatus: EntitlementStatus | null;
  needsReview: boolean;
  reviewReason: string | null;
}

export interface WebhookRecordInput {
  mode: ProviderMode;
  eventId: string;
  type: string;
  providerOrderId: string | null;
}

export interface WebhookPersistenceResult {
  rowId: string;
  replayed: boolean;
}

export interface PaymentOrderJob {
  id: string;
  mode: ProviderMode;
  providerOrderId: string;
  purchaseIntentId: string;
  reconcileToken: string;
}

export class PaymentError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
