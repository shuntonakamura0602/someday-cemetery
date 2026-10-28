import { assertSameOrigin, errorResponse, requirePaymentUserId } from "@/server/payments/auth";
import { getPaymentConfig } from "@/server/payments/config";
import { startCheckout } from "@/server/payments/service";
import { getPaymentStore } from "@/server/payments/store";
import { purposeHash } from "@/server/security/visitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const config = getPaymentConfig();
    assertSameOrigin(request, config.appBaseUrl);
    const userId = await requirePaymentUserId();
    const { id } = await context.params;
    await getPaymentStore().consumeRateLimit(
      "checkout_start",
      purposeHash(`${userId}\0${id}`, "checkout-owner-grave"),
      5,
      60,
    );
    const result = await startCheckout(id, userId);
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
