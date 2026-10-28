import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { getOwnerGrave } from "@/server/db/graves";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    z.uuid().parse(id);
    const grave = await getOwnerGrave(id, user.id);
    if (!grave) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
    return NextResponse.json({ grave }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
