import type { Metadata } from "next";

import { MyGravesExperience } from "@/components/my-graves-experience";

export const metadata: Metadata = { title: "My graves", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MyGravesPage() {
  return <MyGravesExperience />;
}
