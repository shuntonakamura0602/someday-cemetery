import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decodeRecentCursor } from "../../src/server/db/graves";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("recent-grave cursor validation", () => {
  it("accepts only the generated ISO timestamp and UUID shape", () => {
    const valid = {
      createdAt: "2026-10-28T07:00:00.000Z",
      id: "20000000-0000-4000-8000-000000000001",
    };
    expect(decodeRecentCursor(encode(valid))).toEqual(valid);
    expect(decodeRecentCursor(encode({ ...valid, unexpected: true }))).toBeNull();
    expect(decodeRecentCursor(encode({ ...valid, createdAt: "not-a-date" }))).toBeNull();
  });

  it("rejects values that could alter a PostgREST filter", () => {
    expect(
      decodeRecentCursor(encode({
        createdAt: "2026-10-28T07:00:00.000Z",
        id: "20000000-0000-4000-8000-000000000001),status.eq.deleted",
      })),
    ).toBeNull();
  });
});
