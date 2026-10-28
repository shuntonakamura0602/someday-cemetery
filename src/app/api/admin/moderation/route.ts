import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { requireAdmin } from "@/server/auth";
import { moderateGrave } from "@/server/db/admin";
import { assertSameOrigin } from "@/server/security/origin";

export const dynamic = "force-dynamic";

const schema = z.object({
  graveId: z.uuid(),
  action: z.enum(["hide", "republish", "delete", "suspend_entitlement", "restore_entitlement"]),
  reason: z.string().trim().min(3).max(500),
  mode: z.enum(["sandbox", "live"]).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const body = schema.parse(await request.json());
    const result = await moderateGrave(admin.id, body.graveId, body.action, body.reason, body.mode);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
