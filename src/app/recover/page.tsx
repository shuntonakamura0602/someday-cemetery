import type { Metadata } from "next";

import { RecoverExperience } from "@/components/recover-experience";

export const metadata: Metadata = {
  title: "Restore editing access",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default function RecoverPage() {
  return <RecoverExperience />;
}
