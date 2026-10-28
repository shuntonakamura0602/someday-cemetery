import { polarWebhookSdk, receivePolarWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await receivePolarWebhook(request);
    return Response.json(result, { status: "queued" in result ? 202 : 200 });
  } catch (error) {
    if (error instanceof polarWebhookSdk.PolarWebhookVerificationError) {
      return Response.json({ code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid signature." }, { status: 403 });
    }
    if (error instanceof polarWebhookSdk.PolarWebhookError) {
      return Response.json({ code: "INVALID_WEBHOOK_PAYLOAD", message: "Invalid payload." }, { status: 400 });
    }
    return Response.json({ code: "WEBHOOK_NOT_PERSISTED", message: "Please retry delivery." }, { status: 503 });
  }
}
