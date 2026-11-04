import type { Metadata } from "next";

import { MyGravesExperience } from "@/components/my-graves-experience";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "自分の墓碑" : "My graves", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default function MyGravesPage() {
  return <MyGravesExperience />;
}
