import "server-only";

import {
  PaymentError,
  type AppStage,
  type PaymentConfig,
  type PaymentMode,
  type ProviderMode,
} from "./types";

type Env = Record<string, string | undefined>;

const appStages = new Set<AppStage>(["local", "preview", "production"]);
const paymentModes = new Set<PaymentMode>(["off", "sandbox", "live"]);

function parseStage(value: string | undefined): AppStage {
  const stage = value ?? "local";
  if (!appStages.has(stage as AppStage)) {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "APP_STAGE is invalid.");
  }
  return stage as AppStage;
}

function parseMode(value: string | undefined): PaymentMode {
  const mode = value ?? "off";
  if (!paymentModes.has(mode as PaymentMode)) {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "PAYMENTS_MODE is invalid.");
  }
  return mode as PaymentMode;
}

export function entitlementModeForStage(stage: AppStage): ProviderMode {
  return stage === "production" ? "live" : "sandbox";
}

export function paymentConfigFromEnv(env: Env): PaymentConfig {
  const appStage = parseStage(env.APP_STAGE);
  const salesMode = parseMode(env.PAYMENTS_MODE);
  const dataBackend = env.DATA_BACKEND ?? "demo";
  if (dataBackend !== "demo" && dataBackend !== "supabase") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "DATA_BACKEND is invalid.");
  }
  const appBaseUrl = env.APP_BASE_URL ?? "http://127.0.0.1:3000";

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(appBaseUrl);
  } catch {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "APP_BASE_URL must be an absolute URL.");
  }

  if (appStage === "production" && parsedBaseUrl.protocol !== "https:") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "Production APP_BASE_URL must use HTTPS.");
  }
  if (salesMode === "live" && appStage !== "production") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "Live payments are only allowed in production.");
  }
  if (salesMode === "sandbox" && appStage === "production") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "Sandbox payments are not allowed in production.");
  }
  if (dataBackend === "demo" && salesMode !== "off") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "Demo data requires PAYMENTS_MODE=off.");
  }
  if (dataBackend === "demo" && appStage === "production") {
    throw new PaymentError(500, "INVALID_SERVER_CONFIG", "Demo data is not allowed in production.");
  }

  return {
    appStage,
    appBaseUrl: parsedBaseUrl.origin,
    dataBackend,
    salesMode,
    entitlementMode: entitlementModeForStage(appStage),
    accessToken: env.POLAR_ACCESS_TOKEN,
    productId: env.POLAR_PRODUCT_ID,
    webhookSecret: env.POLAR_WEBHOOK_SECRET,
    cronSecret: env.CRON_SECRET,
  };
}

export function getPaymentConfig(): PaymentConfig {
  return paymentConfigFromEnv(process.env);
}

export function requireSalesConfig(config: PaymentConfig): asserts config is PaymentConfig & {
  salesMode: ProviderMode;
  accessToken: string;
  productId: string;
  webhookSecret: string;
  cronSecret: string;
} {
  if (config.salesMode === "off") {
    throw new PaymentError(503, "PAYMENTS_DISABLED", "Purchases are not available right now.");
  }
  if (!config.accessToken || !config.productId || !config.webhookSecret || !config.cronSecret) {
    throw new PaymentError(503, "PAYMENTS_NOT_CONFIGURED", "Purchases are not configured.");
  }
}

export function requireReconciliationConfig(config: PaymentConfig): asserts config is PaymentConfig & {
  accessToken: string;
  productId: string;
} {
  if (!config.accessToken || !config.productId) {
    throw new PaymentError(503, "PAYMENTS_NOT_CONFIGURED", "Payment reconciliation is not configured.");
  }
}
