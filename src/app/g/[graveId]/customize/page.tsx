import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomizeExperience } from "@/components/customize-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "墓石をカスタマイズ" : "Customize headstone", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function CustomizePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  const locale = await getServerLocale();
  return <Suspense fallback={<div className="narrow-page state-page">{locale === "ja" ? "墓石を用意しています…" : "Preparing the headstones…"}</div>}><CustomizeExperience graveId={graveId} /></Suspense>;
}
