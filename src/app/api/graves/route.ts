import { NextResponse } from "next/server";

import { parseCreateGraveInput } from "@/domain";
import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { createGrave, listRecentGraves } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(20, rawLimit)) : 20;
    const result = await listRecentGraves(limit, url.searchParams.get("cursor"));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireVerifiedUser();
    const key = request.headers.get("idempotency-key");
    if (!key || key.length < 8 || key.length > 200) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid request key is required.");
    }
    const input = parseCreateGraveInput(await request.json());
    const result = await createGrave(user.id, input, key, clientIp(request));
    return NextResponse.json(result, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
