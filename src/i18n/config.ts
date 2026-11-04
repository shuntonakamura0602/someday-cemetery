export const SUPPORTED_LOCALES = ["en", "ja"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sc_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;

  const preferences = value
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="));
      return {
        locale: normalizeLocale(tag),
        quality: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter(
      (entry): entry is { locale: Locale; quality: number } =>
        Boolean(entry.locale)
        && Number.isFinite(entry.quality)
        && entry.quality > 0
        && entry.quality <= 1,
    )
    .sort((left, right) => right.quality - left.quality);

  return preferences[0]?.locale ?? DEFAULT_LOCALE;
}

export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage?: string | null): Locale {
  return normalizeLocale(cookieValue) ?? localeFromAcceptLanguage(acceptLanguage);
}

export function localeTag(locale: Locale): "en-US" | "ja-JP" {
  return locale === "ja" ? "ja-JP" : "en-US";
}
