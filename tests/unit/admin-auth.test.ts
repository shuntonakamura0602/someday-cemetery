import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isVerifiedPersistentAdmin } from "../../src/server/auth";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "admin-1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-10-28T00:00:00Z",
    is_anonymous: false,
    email_confirmed_at: "2026-10-28T00:00:00Z",
    ...overrides,
  } as User;
}

describe("administrator eligibility", () => {
  const allowlist = new Set(["admin-1"]);

  it("requires a confirmed persistent identity on the server allowlist", () => {
    expect(isVerifiedPersistentAdmin(user(), allowlist)).toBe(true);
    expect(isVerifiedPersistentAdmin(user({ is_anonymous: true }), allowlist)).toBe(false);
    expect(
      isVerifiedPersistentAdmin(
        user({ email_confirmed_at: undefined, phone_confirmed_at: undefined, confirmed_at: undefined }),
        allowlist,
      ),
    ).toBe(false);
    expect(isVerifiedPersistentAdmin(user({ id: "not-allowed" }), allowlist)).toBe(false);
  });

  it("does not trust editable user metadata for administrator status", () => {
    expect(
      isVerifiedPersistentAdmin(
        user({ id: "not-allowed", user_metadata: { role: "admin", is_admin: true } }),
        allowlist,
      ),
    ).toBe(false);
  });
});
