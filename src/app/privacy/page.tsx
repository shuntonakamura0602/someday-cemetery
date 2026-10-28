import type { Metadata } from "next";

import { getServerEnv } from "@/server/env";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const env = getServerEnv();
  const isDemo = env.DATA_BACKEND === "demo";
  return (
    <article className="content-page">
      <p className="eyebrow">Privacy</p>
      <h1>What the garden keeps.</h1>
      <p className="lede">
        Graves are public by design. We avoid asking for a public name, profile, or email address when you create one.
      </p>

      {isDemo ? (
        <section className="notice-box">
          <h2>This is a local demo</h2>
          <p>
            Demo graves, edits, flowers, and ownership records are stored in this browser. They are not shared with
            other people or devices. Clearing browser storage removes them.
          </p>
        </section>
      ) : null}

      <h2>Public information</h2>
      <p>
        A grave’s project name, optional parting words, optional start year, burial date, garden location, design, and
        flower count are public. Public grave images contain the same memorial information. Do not post personal contact
        details or anything you do not want shared.
      </p>

      <h2>Ownership and cookies</h2>
      <p>
        In the shared service, Supabase creates an anonymous account only when you create a grave or restore access. Auth
        cookies keep that editing session in your browser. A separate signed, HttpOnly visitor cookie helps limit each
        browser to one flower and one open report per grave. Hashed identifiers and rate-limit records are retained only
        for their operational purpose.
      </p>

      <h2>Recovery links</h2>
      <p>
        A private recovery link can transfer editing access. The secret is placed after the <code>#</code> in the link,
        removed from the address bar after it is read, and stored only as a one-way hash on the server. Anyone with the
        full link can take over editing, so keep it private.
      </p>

      <h2>Payments and service providers</h2>
      <p>
        Polar hosts checkout and handles billing information. Someday Cemetery stores only the provider references and
        order state needed to grant a Custom Headstone, reconcile refunds, and resolve payment trouble. Billing details
        are not transferred when grave ownership is restored.
      </p>

      <h2>Deletion and moderation</h2>
      <p>
        Deleting a grave removes its text, recovery hash, and flowers from the active service. Minimal identifiers and
        payment records may remain where needed for reconciliation, refunds, fraud prevention, and an audit trail. A
        hidden grave is removed from public responses but can still be edited by its owner. Copies already saved by
        others or cached outside this service may remain.
      </p>

      <h2>Contact</h2>
      {env.SUPPORT_EMAIL ? (
        <p>
          For privacy or deletion questions, contact <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>.
        </p>
      ) : (
        <p className="notice-box">A real privacy contact and retention periods must be configured before publication.</p>
      )}
    </article>
  );
}
