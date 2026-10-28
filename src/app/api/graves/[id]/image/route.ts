import { z } from "zod";

import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { getPublicGrave } from "@/server/db/graves";
import { renderMemorialPng } from "@/server/images/memorial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    const grave = await getPublicGrave(id);
    if (!grave) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
    const png = await renderMemorialPng(grave, 1);
    return new Response(png as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Content-Disposition": `attachment; filename="someday-cemetery-${grave.id}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
