import "server-only";

import { ApiError } from "@/server/api-errors";
import { getServerEnv } from "@/server/env";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError(403, "INVALID_ORIGIN", "This request could not be verified.");

  const expected = new URL(getServerEnv().APP_BASE_URL).origin;
  if (origin !== expected) {
    throw new ApiError(403, "INVALID_ORIGIN", "This request could not be verified.");
  }
}
