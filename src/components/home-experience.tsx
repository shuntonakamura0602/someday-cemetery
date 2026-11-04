"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CemeteryMap } from "@/components/cemetery/cemetery-map";
import { GraveList } from "@/components/cemetery/grave-list";
import { useCemetery } from "@/components/cemetery-provider";
import { useI18n } from "@/components/language-provider";
import { EXAMPLE_GRAVES } from "@/domain";
import { gardenName, localizeExampleGrave } from "@/i18n/presentation";

export function HomeExperience() {
  const router = useRouter();
  const cemetery = useCemetery();
  const { locale, t, localizeError, formatNumber } = useI18n();
  const [view, setView] = useState<"map" | "list">("map");
  const [randomBusy, setRandomBusy] = useState(false);
  const visibleGraves = useMemo(
    () => cemetery.plots.flatMap((plot) => (plot.grave ? [plot.grave] : [])),
    [cemetery.plots],
  );
  const realVisibleCount = useMemo(
    () => visibleGraves.filter((grave) => !grave.isExample).length,
    [visibleGraves],
  );
  const heroExample = localizeExampleGrave(EXAMPLE_GRAVES[0], locale);
  const text = locale === "ja"
    ? {
        heroEyebrow: "静かな別れのための、みんなの庭",
        heroHeading: "未完成のものが眠る場所。",
        randomBusy: "静かな一角を探しています…",
        wander: "少し歩いてみる",
        cemetery: "墓地",
        chooseGarden: "庭を選ぶ",
        cemeteryView: "墓地の表示方法",
        gardenLoading: "庭が少しずつ見えてきます…",
        retry: "もう一度試す",
        publicRestingPlaces: (count: number) => `公開されている墓碑 ${formatNumber(count)}件`,
        exampleMarkers: "投稿例の印で、庭の使い方を紹介しています",
        chooseOpenPlot: "空いている区画を選ぶ →",
        recentlyBuried: "最近眠りについたもの",
        newArrivals: "新しく加わった墓碑",
        exampleEpitaphs: "いくつかの墓碑銘の例",
        addYourOwn: "あなたのものも加える →",
        whenReady: "心の準備ができたら",
        closing: "手放すことで、少し軽くなるものもあります。",
      }
    : {
        heroEyebrow: "A public garden for private endings",
        heroHeading: "A resting place for unfinished things.",
        randomBusy: "Finding a quiet corner…",
        wander: "Wander a while",
        cemetery: "The cemetery",
        chooseGarden: "Choose a garden",
        cemeteryView: "Cemetery view",
        gardenLoading: "The garden is coming into view…",
        retry: "Try again",
        publicRestingPlaces: (count: number) =>
          `${formatNumber(count)} public ${count === 1 ? "resting place" : "resting places"}`,
        exampleMarkers: "Example markers show how the garden works",
        chooseOpenPlot: "Choose an open plot →",
        recentlyBuried: "Recently laid to rest",
        newArrivals: "New arrivals",
        exampleEpitaphs: "A few example epitaphs",
        addYourOwn: "Add your own →",
        whenReady: "When you are ready",
        closing: "Some things get lighter when you put them down.",
      };

  async function visitRandom() {
    setRandomBusy(true);
    try {
      const grave = await cemetery.randomGrave();
      if (grave) router.push(`/g/${grave.id}`);
      else router.push(`/g/${EXAMPLE_GRAVES[0].id}`);
    } finally {
      setRandomBusy(false);
    }
  }

  return (
    <>
      <section className="home-hero wide-page">
        <div className="hero-copy">
          <p className="eyebrow">{text.heroEyebrow}</p>
          <h1>{locale === "ja" ? text.heroHeading : <>A resting place for <em>unfinished things.</em></>}</h1>
          <p className="hero-description">{t("home.description")}</p>
          <p className="hero-instruction">{t("home.instruction")}</p>
          <div className="actions">
            <Link className="button button-primary" href="/create">{t("action.create")}</Link>
            <button className="button button-secondary" type="button" onClick={visitRandom} disabled={randomBusy}>
              {randomBusy ? text.randomBusy : t("action.random")}
            </button>
          </div>
        </div>
        <div className="hero-aside" aria-hidden="true">
          <div className="moon" />
          <p className="hero-quote">“{heroExample.epitaph}”</p>
          <span>{heroExample.title}</span>
        </div>
      </section>

      <section className="cemetery-section wide-page" id="cemetery">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.wander}</p>
            <h2>{text.cemetery}</h2>
          </div>
          <div className="cemetery-controls">
            {cemetery.gardens.length > 1 ? (
              <label className="garden-select-label">
                <span className="sr-only">{text.chooseGarden}</span>
                <select
                  className="select garden-select"
                  value={cemetery.currentGarden?.id ?? ""}
                  onChange={(event) => void cemetery.selectGarden(event.target.value)}
                >
                  {cemetery.gardens.map((garden) => (
                    <option key={garden.id} value={garden.id}>{gardenName(garden.ordinal, locale)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="pill">{gardenName(cemetery.currentGarden?.ordinal ?? 1, locale)}</span>
            )}
            <div className="segmented" aria-label={text.cemeteryView}>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>{t("action.map")}</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>{t("action.list")}</button>
            </div>
          </div>
        </div>

        {cemetery.loading ? <div className="map-loading">{text.gardenLoading}</div> : null}
        {cemetery.error ? (
          <div className="load-error" role="alert">
            <p>{localizeError(cemetery.error)}</p>
            <button className="button button-secondary" type="button" onClick={() => void cemetery.refresh()}>{text.retry}</button>
          </div>
        ) : null}
        {!cemetery.loading && !cemetery.error && view === "map" ? (
          <CemeteryMap plots={cemetery.plots} onOpenGrave={(id) => router.push(`/g/${id}`)} />
        ) : null}
        {!cemetery.loading && !cemetery.error && view === "list" ? (
          <div className="list-panel panel">
            <GraveList graves={visibleGraves} />
          </div>
        ) : null}
        <div id="after-map" className="garden-caption">
          <span>
            {realVisibleCount > 0
              ? text.publicRestingPlaces(realVisibleCount)
              : text.exampleMarkers}
          </span>
          <Link href="/create">{text.chooseOpenPlot}</Link>
        </div>
      </section>

      <section className="recent-section wide-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text.recentlyBuried}</p>
            <h2>{cemetery.recent.length ? text.newArrivals : text.exampleEpitaphs}</h2>
          </div>
          <Link className="text-link" href="/create">{text.addYourOwn}</Link>
        </div>
        <GraveList graves={(cemetery.recent.length ? cemetery.recent : EXAMPLE_GRAVES.slice(0, 4)) as typeof cemetery.recent} />
      </section>

      <section className="home-closing wide-page">
        <div>
          <p className="eyebrow">{text.whenReady}</p>
          <h2>{text.closing}</h2>
        </div>
        <Link className="button button-primary" href="/create">{t("action.create")}</Link>
      </section>
    </>
  );
}
