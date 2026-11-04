"use client";

import { useI18n } from "@/components/language-provider";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useI18n();
  return (
    <section className="narrow-page state-page">
      <p className="eyebrow">{locale === "ja" ? "静かな中断" : "A quiet interruption"}</p>
      <h1>{locale === "ja" ? "問題が発生しました。" : "Something went wrong."}</h1>
      <p className="lede">{locale === "ja" ? "下書きはこのタブに残っています。もう一度お試しください。" : "Your draft is safe in this tab. Please try again."}</p>
      <button className="button button-primary" type="button" onClick={reset}>
        {locale === "ja" ? "もう一度試す" : "Try again"}
      </button>
    </section>
  );
}
