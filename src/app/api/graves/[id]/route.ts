import { NextResponse } from "next/server";
import { z } from "zod";

import { parseUpdateGraveInput } from "@/domain";
import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { deleteGrave, getPublicGrave, updateGrave } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";

export const dynamic = "force-dynamic";

async function graveId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return z.uuid().parse(id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const grave = await getPublicGrave(await graveId(params));
    if (!grave) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
    return NextResponse.json({ grave }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireVerifiedUser();
    const input = parseUpdateGraveInput(await request.json());
    const grave = await updateGrave(await graveId(params), user.id, input);
    return NextResponse.json({ grave }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireVerifiedUser();
    const body = z.object({ version: z.number().int().positive() }).parse(await request.json());
    await deleteGrave(await graveId(params), user.id, body.version);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
