import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutResultExperience } from "@/components/checkout-result-experience";

export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function CheckoutResultPage() {
  return <Suspense fallback={<div className="narrow-page state-page">Checking the payment…</div>}><CheckoutResultExperience /></Suspense>;
}
