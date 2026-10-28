import { errorResponse, requirePaymentUserId } from "@/server/payments/auth";
import { getPaymentConfig } from "@/server/payments/config";
import { getPaymentStore } from "@/server/payments/store";
import { PaymentError } from "@/server/payments/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ intentId: string }> },
): Promise<Response> {
  try {
    const userId = await requirePaymentUserId();
    const { intentId } = await context.params;
    const config = getPaymentConfig();
    const store = getPaymentStore();
    const intent = await store.getOwnedIntent(intentId, userId);
    if (!intent || intent.mode !== config.entitlementMode) {
      throw new PaymentError(404, "PURCHASE_NOT_FOUND", "The purchase could not be found.");
    }
    const grave = await store.getOwnedGrave(intent.graveId, userId);
    if (!grave) throw new PaymentError(403, "FORBIDDEN", "You do not own this grave.");
    const entitlement = await store.getEntitlement(intent.graveId, intent.mode);
    const state = await store.getMinimalPurchaseState(intent, entitlement);
    return Response.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
