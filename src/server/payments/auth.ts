import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { PaymentError } from "./types";

export async function requirePaymentUserId(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new PaymentError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new PaymentError(401, "AUTH_REQUIRED", "Editing access is required.");
  }
  return data.user.id;
}

export function assertSameOrigin(request: Request, appBaseUrl: string): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(appBaseUrl).origin) {
    throw new PaymentError(403, "INVALID_ORIGIN", "The request origin is not allowed.");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PaymentError) {
    const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
    if (error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
    return Response.json(
      { code: error.code, message: error.message },
      {
        status: error.status,
        headers,
      },
    );
  }
  return Response.json(
    { code: "SERVICE_UNAVAILABLE", message: "Something went wrong. Please try again." },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
