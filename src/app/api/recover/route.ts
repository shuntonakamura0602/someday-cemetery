import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { restoreOwnership } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireVerifiedUser();
    const body = z.object({ graveId: z.uuid(), key: z.string().min(32).max(256) }).parse(await request.json());
    const result = await restoreOwnership(body.graveId, body.key, user.id, clientIp(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
