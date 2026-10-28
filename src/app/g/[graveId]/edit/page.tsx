import type { Metadata } from "next";

import { EditGraveExperience } from "@/components/edit-grave-experience";

export const metadata: Metadata = { title: "Edit grave", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditGravePage({ params }: { params: Promise<{ graveId: string }> }) {
  const { graveId } = await params;
  return <EditGraveExperience graveId={graveId} />;
}
