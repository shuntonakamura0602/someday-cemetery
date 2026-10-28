import type { Metadata } from "next";

import { AdminSignIn } from "@/components/admin-sign-in";

export const metadata: Metadata = { title: "Administrator sign in", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default function AdminSignInPage() { return <AdminSignIn />; }
