import type { Metadata } from "next";

export const metadata: Metadata = { title: "Guidelines" };

export default function GuidelinesPage() {
  return (
    <article className="content-page">
      <p className="eyebrow">Community guidelines</p>
      <h1>Bring your own unfinished things.</h1>
      <p className="lede">
        Someday Cemetery is a public, anonymous place for a project, draft, work, or plan that belonged to you.
      </p>

      <h2>What belongs here</h2>
      <ul>
        <li>A project you stopped building.</li>
        <li>A draft you chose not to finish.</li>
        <li>A plan you quietly outgrew.</li>
        <li>A sincere reflection or a small, kind joke about your own experience.</li>
      </ul>

      <h2>What does not</h2>
      <ul>
        <li>Threats, harassment, hate, or sexual content.</li>
        <li>Personal information, phone numbers, email addresses, or links.</li>
        <li>Spam or promotions.</li>
        <li>A post that treats a real person or somebody else’s work as dead or over.</li>
      </ul>

      <h2>Reporting</h2>
      <p>
        Every public grave has a report action. Reports are private and reviewed by the operator. A report count alone
        does not hide a grave automatically. The operator may hide, restore, or permanently delete content after review.
      </p>
    </article>
  );
}
