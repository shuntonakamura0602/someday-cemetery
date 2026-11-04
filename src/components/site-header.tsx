"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useI18n } from "@/components/language-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import type { Locale } from "@/i18n/config";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const config = useRuntimeConfig();
  const { locale, t } = useI18n();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const languageBusy = switching || isPending;
  const links = [
    ["/", locale === "ja" ? "墓地" : "Cemetery"],
    ["/my-graves", t("action.myGraves")],
    ["/about", t("navigation.about")],
  ] as const;

  async function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale || languageBusy) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) throw new Error("LANGUAGE_SWITCH_FAILED");
      document.documentElement.lang = nextLocale;
      startTransition(() => router.refresh());
    } catch {
      setSwitchError(locale === "ja" ? "言語を変更できませんでした。もう一度お試しください。" : "The language could not be changed. Please try again.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      {config.dataBackend === "demo" ? (
        <div className="demo-ribbon" role="status">
          <span className="demo-ribbon-dot" aria-hidden="true" />
          {t("demo.badge")}
        </div>
      ) : null}
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label={locale === "ja" ? "Someday Cemetery ホーム" : "Someday Cemetery, home"}>
          <span className="wordmark-mark" aria-hidden="true">
            <span />
          </span>
          <span>Someday Cemetery</span>
        </Link>
        <nav className="site-nav" aria-label={locale === "ja" ? "メインナビゲーション" : "Primary navigation"}>
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link className="button button-small button-light" href="/create">
            {t("action.create")}
          </Link>
          <div
            className="language-switcher"
            role="group"
            aria-label={locale === "ja" ? "表示言語" : "Display language"}
            aria-busy={languageBusy}
          >
            <button type="button" aria-pressed={locale === "en"} disabled={languageBusy} onClick={() => void changeLocale("en")}>EN</button>
            <button type="button" aria-pressed={locale === "ja"} disabled={languageBusy} onClick={() => void changeLocale("ja")}>日本語</button>
          </div>
        </nav>
      </header>
      {switchError ? <p className="language-switch-error" role="alert">{switchError}</p> : null}
    </>
  );
}
