import { describe, expect, it } from "vitest";

import { copies, t } from "../../src/domain/copy";
import { EXAMPLE_GRAVES } from "../../src/domain/examples";
import {
  DEFAULT_LOCALE,
  localeFromAcceptLanguage,
  localeTag,
  normalizeLocale,
  resolveLocale,
} from "../../src/i18n/config";
import { localizeFieldErrors, localizeMessage } from "../../src/i18n/errors";
import { accentName, designCopy, gardenName, localizeExampleGrave } from "../../src/i18n/presentation";

describe("locale selection", () => {
  it("normalizes supported language tags and rejects unsupported values", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("ja_JP")).toBe("ja");
    expect(normalizeLocale("fr-FR")).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
  });

  it("prefers the cookie, then weighted browser language, then English", () => {
    expect(resolveLocale("en", "ja-JP,ja;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "en-US;q=0.6,ja-JP;q=0.9")).toBe("ja");
    expect(localeFromAcceptLanguage("fr-FR,ja;q=0.7,en;q=0.5")).toBe("ja");
    expect(localeFromAcceptLanguage("ja;q=0,fr-FR;q=1")).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage("ja;q=1.5,en;q=0.8")).toBe("en");
    expect(resolveLocale(undefined, "fr-FR")).toBe(DEFAULT_LOCALE);
    expect(localeTag("ja")).toBe("ja-JP");
  });
});

describe("localized product copy", () => {
  it("keeps English and Japanese dictionaries complete and non-empty", () => {
    expect(Object.keys(copies.ja).sort()).toEqual(Object.keys(copies.en).sort());
    expect(Object.values(copies.en).every(Boolean)).toBe(true);
    expect(Object.values(copies.ja).every(Boolean)).toBe(true);
    expect(t("action.create", "en")).toBe("Lay something to rest");
    expect(t("action.create", "ja")).toBe("未完成のものを眠らせる");
  });

  it("localizes stable presentation data but preserves real user content", () => {
    const example = localizeExampleGrave(EXAMPLE_GRAVES[0], "ja");
    expect(example.title).toBe("週末アプリ");
    expect(example.epitaph).toContain("週末");

    const userGrave = { ...EXAMPLE_GRAVES[0], id: "user-grave", isExample: false, title: "日本語の作品" };
    expect(localizeExampleGrave(userGrave, "ja").title).toBe("日本語の作品");
    expect(gardenName(2, "ja")).toBe("第2庭園");
    expect(designCopy("wildflowers", "ja").name).toBe("野の花");
    expect(accentName("starlight", "ja")).toBe("星明かり");
  });

  it("localizes stable API codes and validation messages", () => {
    expect(localizeMessage("ja", "raw fallback", "PLOT_TAKEN")).toContain("別の人");
    expect(localizeMessage("en", "raw fallback", "PLOT_TAKEN")).toBe("raw fallback");
    expect(localizeMessage("ja", "Failed to fetch")).toContain("ネットワーク");
    expect(localizeMessage("ja", "raw fallback", "DATABASE_ERROR")).toContain("データベース");
    expect(localizeMessage("ja", "Unexpected provider wording")).toBe("問題が発生しました。もう一度お試しください。");
    expect(localizeFieldErrors("ja", { title: ["Enter a project name."] })).toEqual({
      title: ["プロジェクト名を入力してください。"],
    });
  });
});
