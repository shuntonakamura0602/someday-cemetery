import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/server/api-errors";
import { listGardenPlots } from "@/server/db/graves";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    return NextResponse.json({ plots: await listGardenPlots(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
