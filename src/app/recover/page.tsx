import type { Metadata } from "next";

import { RecoverExperience } from "@/components/recover-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getServerLocale()) === "ja" ? "編集権限を復旧" : "Restore editing access",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
export const dynamic = "force-dynamic";

export default function RecoverPage() {
  return <RecoverExperience />;
}
