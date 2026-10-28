import type { Metadata } from "next";

import { getServerEnv } from "@/server/env";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  const env = getServerEnv();
  return (
    <article className="content-page">
      <p className="eyebrow">Terms</p>
      <h1>A small agreement for a quiet place.</h1>
      <p className="lede">
        By using Someday Cemetery, you agree to post only content you are allowed to share and to follow the community
        guidelines.
      </p>

      <h2>The service</h2>
      <p>
        You can create a public anonymous memorial for your own unfinished project, read other public graves, leave a
        flower, share a public link, and download a standard memorial image. The operator may moderate, hide, or delete
        content that violates the guidelines or creates legal or operational risk.
      </p>

      <h2>Custom Headstone</h2>
      <p>
        Custom Headstone costs US$7, plus any tax shown at checkout. It is a one-time purchase for one grave and unlocks
        the moss, wildflowers, and lantern designs plus a high-resolution keepsake. It does not provide ranking,
        promotion, a subscription, or ownership of a plot outside this service.
      </p>
      <p>
        The designs are available while the service operates. A downloaded keepsake can be saved on your own device. We
        do not promise permanent hosting or permanent operation. If a grave is deleted, the purchase does not prevent
        deletion; refund questions are handled separately.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The service may change, pause new purchases, or end. Pausing checkout does not intentionally remove an existing
        valid entitlement while the service remains available. We may limit abusive traffic or access needed to protect
        the garden.
      </p>

      <h2>Refund and support questions</h2>
      {env.SUPPORT_EMAIL ? (
        <p>
          Contact <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a> with the grave’s public URL and enough
          information to identify the purchase. Do not send a recovery link.
        </p>
      ) : (
        <p className="notice-box">A real support address and operator identity must be added before publication.</p>
      )}
    </article>
  );
}
