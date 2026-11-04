import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutResultExperience } from "@/components/checkout-result-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "決済状況" : "Payment status", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function CheckoutResultPage() {
  const locale = await getServerLocale();
  return <Suspense fallback={<div className="narrow-page state-page">{locale === "ja" ? "決済を確認しています…" : "Checking the payment…"}</div>}><CheckoutResultExperience /></Suspense>;
}
