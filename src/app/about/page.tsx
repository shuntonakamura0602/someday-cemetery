import type { Metadata } from "next";
import Link from "next/link";

import { getServerEnv } from "@/server/env";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  const env = getServerEnv();
  return (
    <article className="content-page">
      <p className="eyebrow">About the garden</p>
      <h1>Not everything unfinished is a failure.</h1>
      <p className="lede">
        Someday Cemetery is a small public garden for projects, drafts, and plans you have decided to stop carrying.
        Some were good ideas at the wrong time. Some taught you what you needed. Some simply ran out of road.
      </p>

      <h2>How it works</h2>
      <p>
        Choose an open plot, give the unfinished thing a name, and add a few parting words if you like. The grave is
        public and anonymous. Visitors can read it and leave one flower from their browser.
      </p>
      <p>
        Creating, sharing, editing, and the standard memorial image are free. A one-time Custom Headstone purchase
        unlocks three additional designs and a high-resolution keepsake for that grave. It never changes where a grave
        appears or how often it is shown.
      </p>

      <h2>A gentle boundary</h2>
      <p>
        This garden is for your own unfinished work—not for declaring another person, their life, or their work over.
        Plain, sincere epitaphs are as welcome as wry ones. Read the <Link href="/guidelines">community guidelines</Link>
        before posting.
      </p>

      <h2>Contact</h2>
      {env.SUPPORT_EMAIL ? (
        <p>
          Questions about a grave, a purchase, or the garden can be sent to{" "}
          <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>
          {env.OPERATOR_NAME ? `, operated by ${env.OPERATOR_NAME}.` : "."}
        </p>
      ) : (
        <p className="notice-box">
          Support contact details have not been configured. They must be added before this site is published.
        </p>
      )}
    </article>
  );
}
