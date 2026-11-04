import type { Metadata } from "next";

import { getServerLocale } from "@/i18n/server";
import { getServerEnv } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "利用規約" : "Terms" };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  const env = getServerEnv();
  if (locale === "ja") {
    return (
      <article className="content-page">
        <p className="eyebrow">利用規約</p>
        <h1>静かな場所のための、小さな約束。</h1>
        <p className="lede">
          Someday Cemeteryを利用することで、あなたは共有する権利のある内容だけを投稿し、コミュニティガイドラインを守ることに同意します。
        </p>

        <h2>サービスについて</h2>
        <p>
          自分自身の未完成のプロジェクトについて、匿名の公開墓碑を作成し、他の公開墓碑を読み、花を手向け、公開リンクを共有し、
          標準画像をダウンロードできます。ガイドライン違反や法的・運用上の危険がある内容は、運営者が確認、非表示、削除する場合があります。
        </p>

        <h2>Custom Headstone</h2>
        <p>
          Custom Headstoneは、決済時に表示される税金を除きUS$7です。墓碑1件に対する1回限りの購入で、苔、野の花、ランタンの
          デザインと高解像度の記念画像を利用できます。順位、宣伝、サブスクリプション、このサービス外の区画所有権は含まれません。
        </p>
        {env.PAYMENTS_MODE === "off" ? (
          <p className="notice-box">この公開ベータでは決済を停止しています。有料デザインはプレビューのみで、購入は開始できません。</p>
        ) : null}
        <p>
          デザインはサービスの運営中に利用できます。ダウンロードした記念画像は自分の端末に保存できます。恒久的なホスティングや
          サービスの永続運営を保証するものではありません。墓碑を削除する場合、購入によって削除が妨げられることはなく、返金については別途対応します。
        </p>

        <h2>提供状況と変更</h2>
        <p>
          サービスは変更、新規購入の一時停止、終了を行う場合があります。サービスが提供されている間、決済の停止を理由に既存の有効な
          利用権を意図的に取り消すことはありません。庭を守るため、不正なアクセスや通信を制限する場合があります。
        </p>

        <h2>運営者</h2>
        {env.OPERATOR_NAME ? <p>{env.OPERATOR_NAME}</p> : <p className="notice-box">公開前に実在する運営者名の設定が必要です。</p>}

        <h2>返金・サポートについて</h2>
        {env.SUPPORT_EMAIL ? (
          <p>
            墓碑の公開URLと購入を特定できる情報を添えて、<a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>まで
            お問い合わせください。復旧リンクは送らないでください。
          </p>
        ) : (
          <p className="notice-box">公開前に実際に受信できるお問い合わせ先の設定が必要です。</p>
        )}
      </article>
    );
  }
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
      {env.PAYMENTS_MODE === "off" ? (
        <p className="notice-box">
          Checkout is disabled in this public beta. Paid designs remain previews and no purchase can be started.
        </p>
      ) : null}
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

      <h2>Operator</h2>
      {env.OPERATOR_NAME ? (
        <p>{env.OPERATOR_NAME}</p>
      ) : (
        <p className="notice-box">A real operator identity must be configured before publication.</p>
      )}

      <h2>Refund and support questions</h2>
      {env.SUPPORT_EMAIL ? (
        <p>
          Contact <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a> with the grave’s public URL and enough
          information to identify the purchase. Do not send a recovery link.
        </p>
      ) : (
        <p className="notice-box">A real support address must be configured before publication.</p>
      )}
    </article>
  );
}
