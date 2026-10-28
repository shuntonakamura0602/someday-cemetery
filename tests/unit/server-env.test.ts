import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getServerEnv, resetEnvForTests } from "../../src/server/env";

const relevantKeys = [
  "APP_STAGE",
  "APP_BASE_URL",
  "DATA_BACKEND",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "PAYMENTS_MODE",
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET",
  "COOKIE_SIGNING_SECRET",
  "VISITOR_HASH_SECRET",
  "CRON_SECRET",
  "ADMIN_USER_IDS",
  "SUPPORT_EMAIL",
  "OPERATOR_NAME",
] as const;

function clearRelevantEnvironment() {
  for (const key of relevantKeys) vi.stubEnv(key, "");
}

function sharedEnvironment(stage: "preview" | "production") {
  vi.stubEnv("APP_STAGE", stage);
  vi.stubEnv("APP_BASE_URL", stage === "production" ? "https://cemetery.example" : "https://preview.example");
  vi.stubEnv("DATA_BACKEND", "supabase");
  vi.stubEnv("PAYMENTS_MODE", "off");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret-key");
  vi.stubEnv("COOKIE_SIGNING_SECRET", "cookie-secret");
  vi.stubEnv("VISITOR_HASH_SECRET", "visitor-secret");
}

describe("server environment publication guards", () => {
  beforeEach(() => {
    clearRelevantEnvironment();
    resetEnvForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvForTests();
  });

  it("requires Turnstile for a shared non-local environment", () => {
    sharedEnvironment("preview");
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    resetEnvForTests();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    expect(getServerEnv().DATA_BACKEND).toBe("supabase");
  });

  it("requires a secure canonical URL and real operator details in production", () => {
    sharedEnvironment("production");
    vi.stubEnv("APP_BASE_URL", "http://cemetery.example");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    expect(() => getServerEnv()).toThrow(/HTTPS/);

    resetEnvForTests();
    vi.stubEnv("APP_BASE_URL", "https://cemetery.example");
    expect(() => getServerEnv()).toThrow(/SUPPORT_EMAIL/);

    resetEnvForTests();
    vi.stubEnv("SUPPORT_EMAIL", "support@example.test");
    vi.stubEnv("OPERATOR_NAME", "Example operator");
    expect(getServerEnv().APP_STAGE).toBe("production");
  });
});
