import "server-only";

import { createPolar, type Polar } from "@polar-sh/sdk/2026-10";

import type { PaymentConfig } from "./types";

let cached: { token: string; mode: string; client: Polar } | null = null;

export function getPolarClient(config: PaymentConfig & { accessToken: string }): Polar {
  if (cached?.token === config.accessToken && cached.mode === config.entitlementMode) {
    return cached.client;
  }
  const client = createPolar({
    accessToken: config.accessToken,
    environment: config.entitlementMode === "sandbox" ? "sandbox" : "production",
    timeout: 12,
  });
  cached = { token: config.accessToken, mode: config.entitlementMode, client };
  return client;
}
