import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin-dashboard";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "庭の管理室" : "Garden office", robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export const dynamic = "force-dynamic";

export default function AdminPage() { return <AdminDashboard />; }
