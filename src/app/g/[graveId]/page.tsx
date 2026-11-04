import type { Metadata } from "next";

import { GraveDetailExperience } from "@/components/grave-detail-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "眠る場所" : "A resting place" };
}

export const dynamic = "force-dynamic";

export default async function GravePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  return <GraveDetailExperience graveId={graveId} />;
}
