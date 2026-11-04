"use client";

import Link from "next/link";

import { useCemetery } from "@/components/cemetery-provider";
import { useI18n } from "@/components/language-provider";
import { gardenName } from "@/i18n/presentation";

export function MyGravesExperience() {
  const { owned, loading, error } = useCemetery();
  const { locale, t, localizeError } = useI18n();
  const isJapanese = locale === "ja";
  const localizedLoadError = error ? localizeError(error) : null;
  return (
    <section className="wide-page collection-page">
      <header className="collection-header">
        <div>
          <p className="eyebrow">{isJapanese ? "このブラウザが管理しています" : "Kept by this browser"}</p>
          <h1>{t("action.myGraves")}</h1>
          <p className="lede">
            {isJapanese
              ? "現在の匿名セッションで編集できる墓碑です。非公開の復旧リンクを使えば、別の端末でも編集権限を復旧できます。"
              : "These are the graves your current anonymous session can edit. A private recovery link can restore one on another device."}
          </p>
        </div>
        <Link className="button button-primary" href="/create">{t("action.create")}</Link>
      </header>
      {loading ? <div className="empty-state">{isJapanese ? "庭を探しています…" : "Looking through the garden…"}</div> : null}
      {error ? (
        <div className="load-error">
          <p>{isJapanese && localizedLoadError === error ? t("error.network") : localizedLoadError}</p>
        </div>
      ) : null}
      {!loading && !error && !owned.length ? (
        <div className="empty-state roomy-empty">
          <h2>{isJapanese ? "まだ何もありません。" : "Nothing here yet."}</h2>
          <p>{isJapanese ? "このブラウザで眠らせたものは、まだありません。" : "You have not laid anything to rest in this browser."}</p>
          <Link className="button button-secondary" href="/recover">
            {isJapanese ? "復旧リンクを使う" : "Use a recovery link"}
          </Link>
        </div>
      ) : null}
      <div className="owner-grave-grid">
        {owned.map((grave) => (
          <article className="card owner-grave-card" key={grave.id}>
            <div className="owner-grave-card-head">
              <span className="pill">
                {grave.status === "hidden" ? (isJapanese ? "非表示" : "Hidden") : gardenName(grave.gardenOrdinal ?? 1, locale)}
              </span>
              <span className="muted tiny">{isJapanese ? `区画 ${grave.plotIndex + 1}` : `Plot ${grave.plotIndex + 1}`}</span>
            </div>
            <h2>{grave.title}</h2>
            {grave.epitaph ? <p>{grave.epitaph}</p> : <p className="muted">{isJapanese ? "別れの言葉はありません。" : "No parting words."}</p>}
            <div className="owner-grave-card-actions">
              <Link className="button button-secondary" href={`/g/${grave.id}`}>{isJapanese ? "見る" : "Visit"}</Link>
              <Link className="button button-secondary" href={`/g/${grave.id}/edit`}>{isJapanese ? "編集" : "Edit"}</Link>
              <Link className="button button-ghost" href={`/g/${grave.id}/customize`}>{isJapanese ? "カスタマイズ" : "Customize"}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
