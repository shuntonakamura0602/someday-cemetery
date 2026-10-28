import Link from "next/link";

export default function NotFound() {
  return (
    <section className="narrow-page state-page">
      <p className="eyebrow">An empty plot</p>
      <h1>This grave isn’t available.</h1>
      <p className="lede">It may have been removed, or the path may be incomplete.</p>
      <Link className="button button-primary" href="/">
        Explore the cemetery
      </Link>
    </section>
  );
}
