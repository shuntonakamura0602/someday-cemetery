import "server-only";

import { ApiError } from "@/server/api-errors";
import { getServerEnv } from "@/server/env";

type TurnstileResponse = { success: boolean; "error-codes"?: string[] };

export async function verifyTurnstile(token: string | undefined, remoteIp?: string) {
  const secret = getServerEnv().TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (getServerEnv().APP_STAGE === "local") return;
    throw new ApiError(503, "BOT_PROTECTION_UNAVAILABLE", "Bot protection is not configured.");
  }
  if (!token) throw new ApiError(422, "BOT_CHECK_REQUIRED", "Please complete the bot check.");

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(503, "BOT_PROTECTION_UNAVAILABLE", "Bot protection is unavailable.");
  const result = (await response.json()) as TurnstileResponse;
  if (!result.success) throw new ApiError(422, "BOT_CHECK_FAILED", "The bot check expired. Please try again.");
}
