import "server-only";

import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const serverEnvSchema = z.object({
  APP_STAGE: z.enum(["local", "preview", "production"]).default("local"),
  APP_BASE_URL: z.url().default("http://127.0.0.1:3000"),
  DATA_BACKEND: z.enum(["demo", "supabase"]).default("demo"),
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SECRET_KEY: optionalString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,
  PAYMENTS_MODE: z.enum(["off", "sandbox", "live"]).default("off"),
  POLAR_ACCESS_TOKEN: optionalString,
  POLAR_PRODUCT_ID: optionalString,
  POLAR_WEBHOOK_SECRET: optionalString,
  COOKIE_SIGNING_SECRET: optionalString,
  VISITOR_HASH_SECRET: optionalString,
  CRON_SECRET: optionalString,
  ADMIN_USER_IDS: z.string().default(""),
  SUPPORT_EMAIL: optionalString,
  OPERATOR_NAME: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  adminUserIds: ReadonlySet<string>;
  entitlementMode: "sandbox" | "live";
};

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.parse(process.env);
  const issues: string[] = [];

  if (parsed.DATA_BACKEND === "demo" && parsed.APP_STAGE === "production") {
    issues.push("DATA_BACKEND=demo is not allowed in production.");
  }
  if (parsed.DATA_BACKEND === "demo" && parsed.PAYMENTS_MODE !== "off") {
    issues.push("The demo backend requires PAYMENTS_MODE=off.");
  }
  if (parsed.PAYMENTS_MODE === "live" && parsed.APP_STAGE !== "production") {
    issues.push("PAYMENTS_MODE=live is allowed only in production.");
  }
  if (parsed.PAYMENTS_MODE === "sandbox" && parsed.APP_STAGE === "production") {
    issues.push("PAYMENTS_MODE=sandbox is not allowed in production.");
  }
  if (parsed.APP_STAGE === "production") {
    if (new URL(parsed.APP_BASE_URL).protocol !== "https:") {
      issues.push("Production APP_BASE_URL must use HTTPS.");
    }
    if (!parsed.SUPPORT_EMAIL) issues.push("SUPPORT_EMAIL is required in production.");
    if (!parsed.OPERATOR_NAME) issues.push("OPERATOR_NAME is required in production.");
  }

  if (parsed.DATA_BACKEND === "supabase") {
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "COOKIE_SIGNING_SECRET",
      "VISITOR_HASH_SECRET",
    ] as const) {
      if (!parsed[key]) issues.push(`${key} is required with DATA_BACKEND=supabase.`);
    }
    if (parsed.APP_STAGE !== "local") {
      for (const key of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const) {
        if (!parsed[key]) issues.push(`${key} is required for shared non-local environments.`);
      }
    }
  }

  if (parsed.PAYMENTS_MODE !== "off") {
    for (const key of ["POLAR_ACCESS_TOKEN", "POLAR_PRODUCT_ID", "POLAR_WEBHOOK_SECRET", "CRON_SECRET"] as const) {
      if (!parsed[key]) issues.push(`${key} is required when payments are enabled.`);
    }
  }

  if (issues.length) {
    throw new Error(`Invalid environment configuration:\n- ${issues.join("\n- ")}`);
  }

  cached = {
    ...parsed,
    adminUserIds: new Set(
      parsed.ADMIN_USER_IDS.split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    entitlementMode: parsed.APP_STAGE === "production" ? "live" : "sandbox",
  };
  return cached;
}

export function publicRuntimeConfig() {
  const env = getServerEnv();
  return {
    appStage: env.APP_STAGE,
    baseUrl: env.APP_BASE_URL,
    dataBackend: env.DATA_BACKEND,
    paymentsMode: env.PAYMENTS_MODE,
    supportEmail: env.SUPPORT_EMAIL ?? null,
    operatorName: env.OPERATOR_NAME ?? null,
    turnstileSiteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabasePublishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
  } as const;
}

export function resetEnvForTests() {
  cached = undefined;
}
