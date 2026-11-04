import type { Metadata } from "next";

import { AdminSignIn } from "@/components/admin-sign-in";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "管理者ログイン" : "Administrator sign in", robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export const dynamic = "force-dynamic";

export default function AdminSignInPage() { return <AdminSignIn />; }
