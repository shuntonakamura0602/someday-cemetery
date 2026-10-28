"use client";

import { createContext, useContext, type ReactNode } from "react";

export type RuntimeConfig = {
  appStage: "local" | "preview" | "production";
  baseUrl: string;
  dataBackend: "demo" | "supabase";
  paymentsMode: "off" | "sandbox" | "live";
  supportEmail: string | null;
  operatorName: string | null;
  turnstileSiteKey: string | null;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
};

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

export function RuntimeConfigProvider({ value, children }: { value: RuntimeConfig; children: ReactNode }) {
  return <RuntimeConfigContext value={value}>{children}</RuntimeConfigContext>;
}

export function useRuntimeConfig() {
  const config = useContext(RuntimeConfigContext);
  if (!config) throw new Error("RuntimeConfigProvider is missing.");
  return config;
}
