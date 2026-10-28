import type { Metadata } from "next";

import { GraveDetailExperience } from "@/components/grave-detail-experience";

export const metadata: Metadata = { title: "A resting place" };

export const dynamic = "force-dynamic";

export default async function GravePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  return <GraveDetailExperience graveId={graveId} />;
}
