import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const defaultMessages: Record<string, string> = {
  INVALID_INPUT: "Please check the highlighted fields.",
  AUTH_REQUIRED: "Editing access is required.",
  FORBIDDEN: "You do not have access to this action.",
  GRAVE_UNAVAILABLE: "This grave isn’t available.",
  PLOT_TAKEN: "Someone else took this plot. Your draft is safe. Choose another spot.",
  VERSION_CONFLICT: "This grave has changed. Review the latest version before saving.",
  RATE_LIMITED: "Please wait a little before trying again.",
  SERVICE_UNAVAILABLE: "Something went wrong. Your draft is safe. Please try again.",
};

export function apiErrorResponse(error: unknown) {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    apiError = new ApiError(422, "INVALID_INPUT", defaultMessages.INVALID_INPUT, fieldErrors);
  } else {
    // Deliberately avoid exposing provider, database, or secret-bearing errors.
    console.error("Unhandled API error", error instanceof Error ? error.name : "unknown");
    apiError = new ApiError(503, "SERVICE_UNAVAILABLE", defaultMessages.SERVICE_UNAVAILABLE);
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (apiError.retryAfter) headers["Retry-After"] = String(apiError.retryAfter);

  return NextResponse.json(
    {
      code: apiError.code,
      message: apiError.message || defaultMessages[apiError.code] || "Something went wrong.",
      ...(apiError.fieldErrors ? { fieldErrors: apiError.fieldErrors } : {}),
    },
    { status: apiError.status, headers },
  );
}

export function unavailableInDemo() {
  return new ApiError(
    400,
    "DEMO_CLIENT_ONLY",
    "Demo changes stay in this browser and do not use the server API.",
  );
}
