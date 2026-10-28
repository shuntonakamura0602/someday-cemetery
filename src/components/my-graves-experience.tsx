"use client";

import Link from "next/link";

import { useCemetery } from "@/components/cemetery-provider";

export function MyGravesExperience() {
  const { owned, loading, error } = useCemetery();
  return (
    <section className="wide-page collection-page">
      <header className="collection-header">
        <div>
          <p className="eyebrow">Kept by this browser</p>
          <h1>My graves</h1>
          <p className="lede">
            These are the graves your current anonymous session can edit. A private recovery link can restore one on
            another device.
          </p>
        </div>
        <Link className="button button-primary" href="/create">Lay something to rest</Link>
      </header>
      {loading ? <div className="empty-state">Looking through the garden…</div> : null}
      {error ? <div className="load-error"><p>{error}</p></div> : null}
      {!loading && !error && !owned.length ? (
        <div className="empty-state roomy-empty">
          <h2>Nothing here yet.</h2>
          <p>You have not laid anything to rest in this browser.</p>
          <Link className="button button-secondary" href="/recover">Use a recovery link</Link>
        </div>
      ) : null}
      <div className="owner-grave-grid">
        {owned.map((grave) => (
          <article className="card owner-grave-card" key={grave.id}>
            <div className="owner-grave-card-head">
              <span className="pill">{grave.status === "hidden" ? "Hidden" : `Garden ${grave.gardenOrdinal ?? 1}`}</span>
              <span className="muted tiny">Plot {grave.plotIndex + 1}</span>
            </div>
            <h2>{grave.title}</h2>
            {grave.epitaph ? <p>{grave.epitaph}</p> : <p className="muted">No parting words.</p>}
            <div className="owner-grave-card-actions">
              <Link className="button button-secondary" href={`/g/${grave.id}`}>Visit</Link>
              <Link className="button button-secondary" href={`/g/${grave.id}/edit`}>Edit</Link>
              <Link className="button button-ghost" href={`/g/${grave.id}/customize`}>Customize</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
