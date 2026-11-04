import type { Metadata } from "next";

import { EditGraveExperience } from "@/components/edit-grave-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "墓碑を編集" : "Edit grave", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function EditGravePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  return <EditGraveExperience graveId={graveId} />;
}
