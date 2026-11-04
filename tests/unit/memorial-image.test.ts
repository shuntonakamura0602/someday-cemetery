import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PublicGraveDto } from "../../src/domain";
import { memorialSvg, renderMemorialPng } from "../../src/server/images/memorial";

function grave(overrides: Partial<PublicGraveDto> = {}): PublicGraveDto {
  return {
    id: "20000000-0000-4000-8000-000000000099",
    gardenId: "10000000-0000-4000-8000-000000000001",
    gardenOrdinal: 1,
    plotIndex: 1,
    title: "A quiet prototype",
    epitaph: "It was enough to imagine it.",
    startedYear: 2024,
    buriedAt: "2026-10-28T00:00:00.000Z",
    style: "classic",
    accent: "stone",
    flowerCount: 0,
    isExample: false,
    ...overrides,
  };
}

describe("server memorial images", () => {
  it("escapes user text before placing it in SVG", () => {
    const svg = memorialSvg(grave({ title: "<script>alert('x')</script>", epitaph: "A & B" }));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("A &amp; B");
  });

  it("renders the free and entitled image dimensions", async () => {
    const [free, keepsake] = await Promise.all([
      renderMemorialPng(grave(), 1),
      renderMemorialPng(grave({ style: "lantern", accent: "amber" }), 2),
    ]);
    await expect(sharp(free).metadata()).resolves.toMatchObject({ width: 1200, height: 630, format: "png" });
    await expect(sharp(keepsake).metadata()).resolves.toMatchObject({ width: 2400, height: 1260, format: "png" });
  }, 20_000);

  it("localizes labels, dates, and stable example content without changing user text", () => {
    const userSvg = memorialSvg(grave({ title: "静かな試作品", epitaph: "想像できただけで十分でした。" }), "ja");
    expect(userSvg).toContain("静かな試作品");
    expect(userSvg).toContain("想像できただけで十分でした。");
    expect(userSvg).toContain("開始 2024年");
    expect(userSvg).toContain("埋葬 2026年10月28日");

    const exampleSvg = memorialSvg(grave({
      id: "20000000-0000-4000-8000-000000000001",
      title: "My Weekend App",
      epitaph: "The weekend was never specified.",
      isExample: true,
    }), "ja");
    expect(exampleSvg).toContain("投稿例");
    expect(exampleSvg).toContain("週末アプリ");
    expect(exampleSvg).not.toContain("My Weekend App");
  });
});
