import type { Metadata } from "next";

import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "ガイドライン" : "Guidelines" };
}

export default async function GuidelinesPage() {
  const locale = await getServerLocale();
  if (locale === "ja") {
    return (
      <article className="content-page">
        <p className="eyebrow">コミュニティガイドライン</p>
        <h1>あなた自身の未完成のものを持ってきてください。</h1>
        <p className="lede">
          Someday Cemeteryは、あなた自身のプロジェクト、下書き、作品、計画のための、公開された匿名の場所です。
        </p>

        <h2>この庭にふさわしいもの</h2>
        <ul>
          <li>開発をやめたプロジェクト。</li>
          <li>完成させないと決めた下書き。</li>
          <li>いつの間にか必要なくなった計画。</li>
          <li>自分自身の経験についての真摯な振り返りや、小さく優しい冗談。</li>
        </ul>

        <h2>この庭にふさわしくないもの</h2>
        <ul>
          <li>脅迫、嫌がらせ、差別的表現、性的な内容。</li>
          <li>個人情報、電話番号、メールアドレス、リンク。</li>
          <li>スパムや宣伝。</li>
          <li>実在する人物や他人の作品を、死んだもの・終わったものとして扱う投稿。</li>
        </ul>

        <h2>通報</h2>
        <p>
          すべての公開墓碑から非公開で通報でき、運営者が内容を確認します。通報数だけで墓碑が自動的に非表示になることはありません。
          確認後、運営者が非表示、復元、または完全な削除を行う場合があります。
        </p>
      </article>
    );
  }
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
