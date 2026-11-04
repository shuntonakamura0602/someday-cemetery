import { z } from "zod";

import { normalizeLocale } from "@/i18n/config";
import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { getPublicGrave } from "@/server/db/graves";
import { renderMemorialPng } from "@/server/images/memorial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    z.uuid().parse(id);
    const grave = await getPublicGrave(id);
    if (!grave) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
    const locale = normalizeLocale(new URL(request.url).searchParams.get("locale")) ?? "en";
    const png = await renderMemorialPng(grave, 1, locale);
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
