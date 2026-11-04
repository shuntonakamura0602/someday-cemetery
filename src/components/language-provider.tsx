"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { t as translate, type CopyKey } from "@/domain/copy";
import { localeTag, type Locale } from "@/i18n/config";
import { localizeMessage } from "@/i18n/errors";

type LanguageContextValue = {
  locale: Locale;
  localeTag: "en-US" | "ja-JP";
  t: (key: CopyKey) => string;
  localizeError: (message: string, code?: string) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LanguageContextValue>(() => {
    const tag = localeTag(locale);
    return {
      locale,
      localeTag: tag,
      t: (key) => translate(key, locale),
      localizeError: (message, code) => localizeMessage(locale, message, code),
      formatDate: (date, options) => new Intl.DateTimeFormat(tag, options).format(new Date(date)),
      formatNumber: (number, options) => new Intl.NumberFormat(tag, options).format(number),
    };
  }, [locale]);

  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useI18n(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is missing.");
  return value;
}
