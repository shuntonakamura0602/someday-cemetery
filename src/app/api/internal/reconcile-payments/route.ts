import { timingSafeEqual } from "node:crypto";

import { getPaymentConfig } from "@/server/payments/config";
import { runPaymentReconciliation } from "@/server/payments/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSecretEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const config = getPaymentConfig();
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!config.cronSecret || !safeSecretEqual(received, config.cronSecret)) {
    return Response.json({ code: "FORBIDDEN", message: "Forbidden." }, { status: 403 });
  }
  try {
    const result = await runPaymentReconciliation(25);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { code: "SERVICE_UNAVAILABLE", message: "Reconciliation could not complete." },
      { status: 503 },
    );
  }
}
