import { describe, expect, it } from "vitest";
import {
  DEMO_GARDEN_ID,
  DESIGNS,
  EXAMPLE_GRAVES,
  GARDEN_V1_PLOTS,
  buildRecoveryUrl,
  countGraphemes,
  findDisallowedContact,
  getEffectiveStyle,
  getPlotPosition,
  normalizeEpitaph,
  normalizeTitle,
  parseCreateGraveInput,
  parseRecoveryFragment,
  parseUpdateGraveInput,
  wrapText,
} from "../../src/domain";

describe("grave input rules", () => {
  it("counts user-perceived graphemes", () => {
    expect(countGraphemes("👨‍👩‍👧‍👦")).toBe(1);
    expect(countGraphemes("e\u0301")).toBe(1);
    expect(countGraphemes("日本語")).toBe(3);
  });

  it("normalizes NFC, line endings, and title newlines", () => {
    expect(normalizeTitle("  Cafe\u0301\r\nNotes  ")).toBe("Café Notes");
    expect(normalizeEpitaph(" first\r\nsecond\rthird ")).toBe("first\nsecond\nthird");
  });

  it("accepts boundary input without truncation", () => {
    const title = "🌒".repeat(48);
    const epitaph = "a".repeat(160);
    const value = parseCreateGraveInput({
      gardenId: DEMO_GARDEN_ID,
      plotIndex: 99,
      title,
      epitaph,
      startedYear: "2020",
    });
    expect(value.title).toBe(title);
    expect(value.epitaph).toBe(epitaph);
    expect(value.startedYear).toBe(2020);
  });

  it("rejects overlong, four-line, and contact content", () => {
    expect(() => parseCreateGraveInput({ gardenId: DEMO_GARDEN_ID, plotIndex: 0, title: "x".repeat(49) })).toThrow();
    expect(() => parseCreateGraveInput({ gardenId: DEMO_GARDEN_ID, plotIndex: 0, title: "A", epitaph: "1\n2\n3\n4" })).toThrow();
    expect(findDisallowedContact("write me at person@example.com")).toBe("email");
    expect(findDisallowedContact("see https://example.com")).toBe("url");
    expect(findDisallowedContact("call +1 (415) 555-1212")).toBe("phone");
  });

  it("enforces the design accent allowlist", () => {
    expect(() => parseUpdateGraveInput({
      title: "A project",
      selectedStyle: "moss",
      accent: "ember",
      version: 1,
    })).toThrow();
    expect(parseUpdateGraveInput({
      title: "A project",
      selectedStyle: "moss",
      accent: "fern",
      version: 1,
    }).accent).toBe("fern");
  });
});

describe("stable presentation definitions", () => {
  it("contains exactly 100 unique versioned plots", () => {
    expect(GARDEN_V1_PLOTS).toHaveLength(100);
    expect(new Set(GARDEN_V1_PLOTS.map(({ x, y }) => `${x}:${y}`)).size).toBe(100);
    expect(getPlotPosition(99).index).toBe(99);
    expect(() => getPlotPosition(100)).toThrow(RangeError);
  });

  it("keeps all twelve examples explicit and non-activity-bearing", () => {
    expect(EXAMPLE_GRAVES).toHaveLength(12);
    expect(EXAMPLE_GRAVES.every((grave) => grave.isExample && grave.flowerCount === 0)).toBe(true);
    expect(new Set(EXAMPLE_GRAVES.map((grave) => grave.id)).size).toBe(12);
  });

  it("falls back to classic when there is no paid entitlement", () => {
    expect(getEffectiveStyle("lantern", false)).toBe("classic");
    expect(getEffectiveStyle("lantern", true)).toBe("lantern");
    expect(getEffectiveStyle("wildflowers", false, true)).toBe("wildflowers");
    expect(DESIGNS.classic.paid).toBe(false);
  });
});

describe("safe recovery and image text", () => {
  it("puts recovery secrets in the fragment only", () => {
    const url = new URL(buildRecoveryUrl("https://cemetery.example/path", "grave-id", "secret-token"));
    expect(url.pathname).toBe("/recover");
    expect(url.search).toBe("");
    expect(url.hash).toContain("key=secret-token");
    expect(parseRecoveryFragment(url.hash)).toEqual({ graveId: "grave-id", key: "secret-token" });
  });

  it("wraps a long word without dropping any graphemes", () => {
    const source = "averyveryverylongword";
    const lines = wrapText(source, 5, (text) => text.length);
    expect(lines.join("")).toBe(source);
    expect(lines.every((line) => line.length <= 5)).toBe(true);
  });
});
