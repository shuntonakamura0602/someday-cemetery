import { z } from "zod";

import { normalizeLocale } from "@/i18n/config";
import { apiErrorResponse, ApiError } from "@/server/api-errors";
import { requireVerifiedUser } from "@/server/auth";
import { consumeRateLimit, getOwnerKeepsakeGrave } from "@/server/db/graves";
import { renderMemorialPng } from "@/server/images/memorial";
import { purposeHash } from "@/server/security/visitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    z.uuid().parse(id);
    await consumeRateLimit("keepsake", purposeHash(user.id, "keepsake-owner"), 5, 60);
    const grave = await getOwnerKeepsakeGrave(id, user.id);
    if (!grave) throw new ApiError(403, "ENTITLEMENT_REQUIRED", "A Custom Headstone is required for this image.");
    const locale = normalizeLocale(new URL(request.url).searchParams.get("locale")) ?? "en";
    const png = await renderMemorialPng(grave, 2, locale);
    return new Response(png as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Content-Disposition": `attachment; filename="someday-cemetery-keepsake-${grave.id}.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
