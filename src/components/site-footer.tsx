"use client";

import Link from "next/link";

import { useI18n } from "@/components/language-provider";
import type { RuntimeConfig } from "@/components/runtime-config";

export function SiteFooter({ config }: { config: RuntimeConfig }) {
  const { locale, t } = useI18n();
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-name">Someday Cemetery</p>
        <p className="muted">{t("home.tagline")}</p>
      </div>
      <nav aria-label={locale === "ja" ? "フッターナビゲーション" : "Footer navigation"}>
        <Link href="/guidelines">{t("navigation.guidelines")}</Link>
        <Link href="/privacy">{t("navigation.privacy")}</Link>
        <Link href="/terms">{t("navigation.terms")}</Link>
        {config.supportEmail ? <a href={`mailto:${config.supportEmail}`}>{t("navigation.support")}</a> : null}
      </nav>
    </footer>
  );
}
