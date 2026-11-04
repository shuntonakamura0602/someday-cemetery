import type { Metadata } from "next";
import Link from "next/link";

import { getServerLocale } from "@/i18n/server";
import { getServerEnv } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "この場所について" : "About" };
}

export default async function AboutPage() {
  const locale = await getServerLocale();
  const env = getServerEnv();
  if (locale === "ja") {
    return (
      <article className="content-page">
        <p className="eyebrow">この庭について</p>
        <h1>未完成だったものが、すべて失敗とは限りません。</h1>
        <p className="lede">
          Someday Cemeteryは、もう抱え続けないと決めたプロジェクト、下書き、計画のための小さな公共の庭です。
          時期が合わなかった良いアイデアも、必要なことを教えてくれた試みも、ただ道が途切れたものもあります。
        </p>

        <h2>使い方</h2>
        <p>
          空いている区画を選び、未完成のものに名前を付け、よければ短い別れの言葉を添えます。墓碑は匿名で公開され、
          訪れた人はそれを読み、自分のブラウザから一輪の花を手向けられます。
        </p>
        <p>
          作成、共有、編集、標準画像の保存は無料です。Custom Headstoneを一度購入すると、その墓碑で3種類の追加デザインと
          高解像度の記念画像を利用できます。購入によって墓碑の表示位置や表示頻度が変わることはありません。
        </p>

        <h2>大切な境界</h2>
        <p>
          この庭は、あなた自身の未完成のもののための場所です。他人やその人生、他人の作品が終わったと宣言する場所ではありません。
          真摯な墓碑銘も、自分自身への小さく優しい冗談も歓迎します。投稿前に
          <Link href="/guidelines">コミュニティガイドライン</Link>をお読みください。
        </p>

        <h2>お問い合わせ</h2>
        {env.SUPPORT_EMAIL ? (
          <p>
            墓碑、購入、この庭についてのご質問は、<a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>
            までお送りください{env.OPERATOR_NAME ? `。運営者は${env.OPERATOR_NAME}です。` : "。"}
          </p>
        ) : (
          <p className="notice-box">お問い合わせ先が設定されていません。公開前に設定が必要です。</p>
        )}
      </article>
    );
  }
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
