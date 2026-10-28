import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/server/api-errors";
import { requireAdmin } from "@/server/auth";
import { getAdminDashboard } from "@/server/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAdminDashboard(), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
