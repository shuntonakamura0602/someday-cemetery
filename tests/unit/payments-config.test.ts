import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  entitlementModeForStage,
  paymentConfigFromEnv,
  requireSalesConfig,
} from "../../src/server/payments/config";

describe("payment environment isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives entitlement lookup independently from whether new sales are off", () => {
    expect(entitlementModeForStage("local")).toBe("sandbox");
    expect(entitlementModeForStage("preview")).toBe("sandbox");
    expect(entitlementModeForStage("production")).toBe("live");

    expect(
      paymentConfigFromEnv({
        APP_STAGE: "production",
        APP_BASE_URL: "https://example.com",
        DATA_BACKEND: "supabase",
        PAYMENTS_MODE: "off",
      }).entitlementMode,
    ).toBe("live");
  });

  it("rejects sandbox sales in production and live sales outside production", () => {
    expect(() =>
      paymentConfigFromEnv({
        APP_STAGE: "production",
        APP_BASE_URL: "https://example.com",
        DATA_BACKEND: "supabase",
        PAYMENTS_MODE: "sandbox",
      }),
    ).toThrow(/Sandbox payments/);
    expect(() =>
      paymentConfigFromEnv({
        APP_STAGE: "preview",
        APP_BASE_URL: "https://preview.example.com",
        DATA_BACKEND: "supabase",
        PAYMENTS_MODE: "live",
      }),
    ).toThrow(/Live payments/);
  });

  it("keeps the browser-only demo honest by requiring payments off", () => {
    expect(() =>
      paymentConfigFromEnv({
        APP_STAGE: "local",
        APP_BASE_URL: "http://127.0.0.1:3000",
        DATA_BACKEND: "demo",
        PAYMENTS_MODE: "sandbox",
      }),
    ).toThrow(/Demo data requires/);
    expect(() =>
      paymentConfigFromEnv({
        APP_STAGE: "production",
        APP_BASE_URL: "https://example.com",
        DATA_BACKEND: "demo",
        PAYMENTS_MODE: "off",
      }),
    ).toThrow(/not allowed in production/);
  });

  it("requires HTTPS for the production canonical origin", () => {
    expect(() =>
      paymentConfigFromEnv({
        APP_STAGE: "production",
        APP_BASE_URL: "http://example.com",
        DATA_BACKEND: "supabase",
        PAYMENTS_MODE: "off",
      }),
    ).toThrow(/HTTPS/);
  });

  it("does not open sales without webhook and reconciliation protection", () => {
    const incomplete = paymentConfigFromEnv({
      APP_STAGE: "local",
      APP_BASE_URL: "http://127.0.0.1:3000",
      DATA_BACKEND: "supabase",
      PAYMENTS_MODE: "sandbox",
      POLAR_ACCESS_TOKEN: "sandbox-token",
      POLAR_PRODUCT_ID: "sandbox-product",
    });
    expect(() => requireSalesConfig(incomplete)).toThrow(/not configured/);
  });
});
