import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { rotateRecoveryLink } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireVerifiedUser();
    const { id } = await params;
    z.uuid().parse(id);
    return NextResponse.json(
      { recoveryUrl: await rotateRecoveryLink(id, user.id) },
      { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
