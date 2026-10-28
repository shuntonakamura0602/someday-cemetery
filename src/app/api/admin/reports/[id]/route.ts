import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { requireAdmin } from "@/server/auth";
import { moderateReport } from "@/server/db/admin";
import { assertSameOrigin } from "@/server/security/origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const body = z.object({
      action: z.enum(["resolve_report", "dismiss_report"]),
      reason: z.string().trim().min(3).max(500),
    }).parse(await request.json());
    const result = await moderateReport(admin.id, id, body.action, body.reason);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
