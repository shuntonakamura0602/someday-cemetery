import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/server/api-errors";
import { getRandomGrave } from "@/server/db/graves";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ grave: await getRandomGrave() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
