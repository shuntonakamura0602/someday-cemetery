"use client";

import Link from "next/link";

import { useI18n } from "@/components/language-provider";

export default function NotFound() {
  const { locale, t } = useI18n();
  return (
    <section className="narrow-page state-page">
      <p className="eyebrow">{locale === "ja" ? "空の区画" : "An empty plot"}</p>
      <h1>{t("error.unavailable")}</h1>
      <p className="lede">{locale === "ja" ? "削除されたか、URLが正しくない可能性があります。" : "It may have been removed, or the path may be incomplete."}</p>
      <Link className="button button-primary" href="/">
        {t("action.explore")}
      </Link>
    </section>
  );
}
