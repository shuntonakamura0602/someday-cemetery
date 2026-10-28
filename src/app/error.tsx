"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="narrow-page state-page">
      <p className="eyebrow">A quiet interruption</p>
      <h1>Something went wrong.</h1>
      <p className="lede">Your draft is safe in this tab. Please try again.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
