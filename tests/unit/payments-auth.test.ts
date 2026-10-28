import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { errorResponse } from "../../src/server/payments/auth";
import { PaymentError } from "../../src/server/payments/types";

describe("payment API errors", () => {
  it("keeps owner errors private and gives rate-limited clients a retry time", async () => {
    const response = errorResponse(new PaymentError(429, "RATE_LIMITED", "Please wait.", 60));
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({ code: "RATE_LIMITED", message: "Please wait." });
  });

  it("does not expose unexpected provider errors", async () => {
    const response = errorResponse(new Error("secret provider detail"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      code: "SERVICE_UNAVAILABLE",
      message: "Something went wrong. Please try again.",
    });
  });
});
