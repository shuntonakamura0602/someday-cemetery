import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { consumeRateLimit, leaveFlower } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";
import { createVisitorId, purposeHash, readVisitorId, setVisitorCookie, visitorCookieName } from "@/server/security/visitor";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const cookieStore = await cookies();
    let visitorId = readVisitorId(cookieStore.get(visitorCookieName())?.value);
    let signed: string | null = null;
    if (!visitorId) {
      const created = createVisitorId();
      visitorId = created.value;
      signed = created.signed;
    }
    await consumeRateLimit("flower", purposeHash(visitorId, "flower-rate"), 30, 60);
    const result = await leaveFlower(id, purposeHash(visitorId, "flower-unique"));
    const response = NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    if (signed) setVisitorCookie(response, signed);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
