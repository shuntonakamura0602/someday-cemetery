import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { countGraphemes } from "@/domain";
import { apiErrorResponse } from "@/server/api-errors";
import { createReport } from "@/server/db/graves";
import { assertSameOrigin } from "@/server/security/origin";
import { clientIp } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";
import { createVisitorId, purposeHash, readVisitorId, setVisitorCookie, visitorCookieName } from "@/server/security/visitor";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.enum(["spam", "harassment", "personal_information", "real_person", "other"]),
  details: z.string().trim().refine((value) => countGraphemes(value) <= 500, "Use 500 characters or fewer.").optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const body = schema.parse(await request.json());
    const ip = clientIp(request);
    await verifyTurnstile(body.turnstileToken, ip === "unknown" ? undefined : ip);
    const cookieStore = await cookies();
    let visitorId = readVisitorId(cookieStore.get(visitorCookieName())?.value);
    let signed: string | null = null;
    if (!visitorId) {
      const created = createVisitorId();
      visitorId = created.value;
      signed = created.signed;
    }
    await createReport(
      id,
      purposeHash(visitorId, "report-unique"),
      purposeHash(visitorId, "report-rate"),
      body.reason,
      body.details,
    );
    const response = NextResponse.json({ received: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
    if (signed) setVisitorCookie(response, signed);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
