import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { listOwnerGraves } from "@/server/db/graves";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireVerifiedUser();
    return NextResponse.json({ items: await listOwnerGraves(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
