import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { requireAdmin } from "@/server/auth";
import { recordPaymentReconciliation } from "@/server/db/admin";
import { assertSameOrigin } from "@/server/security/origin";
import { reconcileIntent } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ intentId: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { intentId } = await params;
    z.uuid().parse(intentId);
    const { reason } = z.object({
      reason: z.string().trim().min(3).max(500),
    }).parse(await request.json());
    const result = await reconcileIntent(intentId);
    await recordPaymentReconciliation(admin.id, intentId, reason);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
