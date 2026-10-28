import { assertSameOrigin, errorResponse, requirePaymentUserId } from "@/server/payments/auth";
import { getPaymentConfig } from "@/server/payments/config";
import { reconcileIntent } from "@/server/payments/service";
import { getPaymentStore } from "@/server/payments/store";
import { PaymentError } from "@/server/payments/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> },
): Promise<Response> {
  try {
    const config = getPaymentConfig();
    assertSameOrigin(request, config.appBaseUrl);
    const userId = await requirePaymentUserId();
    const { intentId } = await context.params;
    const store = getPaymentStore();
    const owned = await store.getOwnedIntent(intentId, userId);
    if (!owned || owned.mode !== config.entitlementMode) {
      throw new PaymentError(404, "PURCHASE_NOT_FOUND", "The purchase could not be found.");
    }
    const grave = await store.getOwnedGrave(owned.graveId, userId);
    if (!grave) throw new PaymentError(403, "FORBIDDEN", "You do not own this grave.");
    const state = await reconcileIntent(intentId);
    return Response.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
