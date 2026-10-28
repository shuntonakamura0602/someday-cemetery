import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomizeExperience } from "@/components/customize-experience";

export const metadata: Metadata = { title: "Customize headstone", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CustomizePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  return <Suspense fallback={<div className="narrow-page state-page">Preparing the headstones…</div>}><CustomizeExperience graveId={graveId} /></Suspense>;
}
