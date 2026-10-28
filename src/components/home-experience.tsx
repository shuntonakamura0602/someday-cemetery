"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CemeteryMap } from "@/components/cemetery/cemetery-map";
import { GraveList } from "@/components/cemetery/grave-list";
import { useCemetery } from "@/components/cemetery-provider";
import { EXAMPLE_GRAVES, t } from "@/domain";

export function HomeExperience() {
  const router = useRouter();
  const cemetery = useCemetery();
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
          <p className="eyebrow">A public garden for private endings</p>
          <h1>
            A resting place for <em>unfinished things.</em>
          </h1>
          <p className="hero-description">{t("home.description")}</p>
          <p className="hero-instruction">{t("home.instruction")}</p>
          <div className="actions">
            <Link className="button button-primary" href="/create">{t("action.create")}</Link>
            <button className="button button-secondary" type="button" onClick={visitRandom} disabled={randomBusy}>
              {randomBusy ? "Finding a quiet corner…" : t("action.random")}
            </button>
          </div>
        </div>
        <div className="hero-aside" aria-hidden="true">
          <div className="moon" />
          <p className="hero-quote">“The weekend was never specified.”</p>
          <span>My Weekend App</span>
        </div>
      </section>

      <section className="cemetery-section wide-page" id="cemetery">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Wander a while</p>
            <h2>The cemetery</h2>
          </div>
          <div className="cemetery-controls">
            {cemetery.gardens.length > 1 ? (
              <label className="garden-select-label">
                <span className="sr-only">Choose a garden</span>
                <select
                  className="select garden-select"
                  value={cemetery.currentGarden?.id ?? ""}
                  onChange={(event) => void cemetery.selectGarden(event.target.value)}
                >
                  {cemetery.gardens.map((garden) => (
                    <option key={garden.id} value={garden.id}>{garden.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="pill">{cemetery.currentGarden?.name ?? "Garden 1"}</span>
            )}
            <div className="segmented" aria-label="Cemetery view">
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>{t("action.map")}</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>{t("action.list")}</button>
            </div>
          </div>
        </div>

        {cemetery.loading ? <div className="map-loading">The garden is coming into view…</div> : null}
        {cemetery.error ? (
          <div className="load-error" role="alert">
            <p>{cemetery.error}</p>
            <button className="button button-secondary" type="button" onClick={() => void cemetery.refresh()}>Try again</button>
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
              ? `${realVisibleCount} public ${realVisibleCount === 1 ? "resting place" : "resting places"}`
              : "Example markers show how the garden works"}
          </span>
          <Link href="/create">Choose an open plot →</Link>
        </div>
      </section>

      <section className="recent-section wide-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recently laid to rest</p>
            <h2>{cemetery.recent.length ? "New arrivals" : "A few example epitaphs"}</h2>
          </div>
          <Link className="text-link" href="/create">Add your own →</Link>
        </div>
        <GraveList graves={(cemetery.recent.length ? cemetery.recent : EXAMPLE_GRAVES.slice(0, 4)) as typeof cemetery.recent} />
      </section>

      <section className="home-closing wide-page">
        <div>
          <p className="eyebrow">When you are ready</p>
          <h2>Some things get lighter when you put them down.</h2>
        </div>
        <Link className="button button-primary" href="/create">{t("action.create")}</Link>
      </section>
    </>
  );
}
