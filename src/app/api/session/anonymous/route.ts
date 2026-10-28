import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { getServerEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (getServerEnv().DATA_BACKEND !== "supabase") throw new ApiError(400, "DEMO_CLIENT_ONLY", "The demo session stays in this browser.");
    const body = z.object({ captchaToken: z.string().optional() }).parse(await request.json().catch(() => ({})));
    const client = await createSupabaseServerClient();
    const { data: existing } = await client.auth.getUser();
    if (existing.user) {
      return NextResponse.json({ userId: existing.user.id }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { data, error } = await client.auth.signInAnonymously(
      body.captchaToken ? { options: { captchaToken: body.captchaToken } } : undefined,
    );
    if (error || !data.user) throw new ApiError(503, "AUTH_UNAVAILABLE", "An anonymous editing session could not be created.");
    return NextResponse.json({ userId: data.user.id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
