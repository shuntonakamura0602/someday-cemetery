import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildCheckoutRequest } from "../../src/server/payments/service";
import type { PaymentConfig, PurchaseIntent } from "../../src/server/payments/types";

describe("Polar checkout request", () => {
  it("uses only the server product and binds the grave and purchase intent", () => {
    const config: PaymentConfig & { productId: string } = {
      appStage: "local",
      appBaseUrl: "https://preview.example.test",
      dataBackend: "supabase",
      salesMode: "sandbox",
      entitlementMode: "sandbox",
      accessToken: "server-only",
      productId: "server-product",
      webhookSecret: "server-only",
      cronSecret: "server-only",
    };
    const intent: PurchaseIntent = {
      id: "intent-1",
      graveId: "grave-1",
      ownerAtCreation: "owner-1",
      mode: "sandbox",
      status: "creating",
      providerCheckoutId: null,
      checkoutUrl: null,
      providerOrderId: null,
    };

    const request = buildCheckoutRequest(config, intent);
    expect(request.products).toEqual(["server-product"]);
    expect(request.allow_discount_codes).toBe(false);
    expect(request.allow_trial).toBe(false);
    expect(request.metadata).toEqual({ purchase_intent_id: "intent-1", grave_id: "grave-1" });
    expect(request.success_url).toBe(
      "https://preview.example.test/checkout/result?intent=intent-1&checkout_id={CHECKOUT_ID}",
    );
    expect(request.return_url).toBe(
      "https://preview.example.test/g/grave-1/customize?checkout=cancelled",
    );
    expect("customer_email" in request).toBe(false);
    expect("discount_id" in request).toBe(false);
  });
});
