import type { Metadata } from "next";

import { getServerLocale } from "@/i18n/server";
import { getServerEnv } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getServerLocale()) === "ja" ? "プライバシー" : "Privacy" };
}

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  const env = getServerEnv();
  const isDemo = env.DATA_BACKEND === "demo";
  if (locale === "ja") {
    return (
      <article className="content-page">
        <p className="eyebrow">プライバシー</p>
        <h1>この庭が保存するもの。</h1>
        <p className="lede">
          墓碑は公開を前提としています。作成時に、公開名、プロフィール、メールアドレスの入力は求めません。
        </p>

        {isDemo ? (
          <section className="notice-box">
            <h2>これはローカルデモです</h2>
            <p>
              デモで作成した墓碑、編集内容、献花、所有権の記録は、このブラウザに保存されます。他の人や端末とは共有されません。
              ブラウザの保存データを消去すると削除されます。
            </p>
          </section>
        ) : null}

        <h2>公開される情報</h2>
        <p>
          プロジェクト名、任意の別れの言葉、任意の開始年、埋葬日、庭の場所、デザイン、花の数は公開されます。
          公開墓碑の画像にも同じ情報が含まれます。個人の連絡先や、公開したくない情報は投稿しないでください。
        </p>

        <h2>所有権とCookie</h2>
        <p>
          共有サービスでは、墓碑を作成するか編集権限を復旧するときにのみ、Supabaseが匿名アカウントを作成します。
          認証Cookieは、このブラウザで編集セッションを維持するために使われます。別の署名付きHttpOnly訪問者Cookieは、
          1つのブラウザから各墓碑への献花と未解決の通報をそれぞれ1回に制限するために使われ、設定から1年後に失効します。
          言語設定Cookieは英語または日本語の選択を1年間保存します。
        </p>

        <h2>復旧リンク</h2>
        <p>
          非公開の復旧リンクで編集権限を移すことができます。秘密情報はリンクの<code>#</code>以降に置かれ、読み取り後に
          アドレスバーから削除されます。サーバーには一方向ハッシュだけを保存します。完全なリンクを知っている人は編集権限を
          引き継げるため、公開しないでください。
        </p>

        <h2>決済と外部サービス</h2>
        {env.PAYMENTS_MODE === "off" ? (
          <p>
            この公開ベータでは決済を停止しているため、新しい購入手続きは開始できません。決済を有効にした場合、Polarが
            購入画面を提供し、請求情報を処理します。Someday Cemeteryは、Custom Headstoneの付与、返金の照合、決済問題の
            解決に必要な事業者参照情報と注文状態のみを保存します。
          </p>
        ) : (
          <p>
            Polarが購入画面を提供し、請求情報を処理します。Someday Cemeteryは、Custom Headstoneの付与、返金の照合、
            決済問題の解決に必要な事業者参照情報と注文状態のみを保存します。墓碑の所有権を復旧しても、請求情報は移りません。
          </p>
        )}

        <h2>削除とモデレーション</h2>
        <p>
          墓碑を削除すると、プロジェクト名、別れの言葉、開始年、有効な所有者との関連、復旧ハッシュ、花は稼働中のサービスから
          直ちに削除されます。以前のURLや区画の履歴が黙って再利用されないよう、非公開の墓標記録は残ります。安全上の判断を
          記録するため、通報とモデレーション記録を保持します。照合、返金、異議申立て、不正防止、監査に必要な最小限の決済・
          事業者記録が残る場合があります。非表示の墓碑は公開応答から除外されますが、所有者は編集できます。他の人が保存した
          コピーや、このサービスの外部にキャッシュされたコピーは残る場合があります。
        </p>

        <h2>保持期間</h2>
        <p>
          公開または非表示の墓碑内容、復旧ハッシュ、献花の重複防止ハッシュは、墓碑が削除されるまで保持します。作成リクエストの
          冪等性記録は7日後に失効し、レート制限記録は各記録の失効時刻に失効します。どちらも日次メンテナンスで削除します。
          解決済みまたは却下済みの通報と対応する判断ログは1年後に削除します。未解決の通報は確認が終わるまで保持します。
        </p>
        <p>
          有効な墓碑を所有しない匿名アカウントは、90日後から削除対象になります。墓碑を所有しているアカウントや、決済・
          モデレーション記録に必要なアカウントは保持します。非公開の墓標、その他のモデレーション記録、決済証跡には現在、
          自動削除日を設定していません。外部事業者のバックアップには、その管理されたバックアップ期間が終わるまで古いコピーが
          含まれる場合があります。
        </p>

        <h2>運営者</h2>
        {env.OPERATOR_NAME ? <p>{env.OPERATOR_NAME}</p> : <p className="notice-box">公開前に実在する運営者名の設定が必要です。</p>}

        <h2>お問い合わせ</h2>
        {env.SUPPORT_EMAIL ? (
          <p>プライバシーや削除については、<a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>までお問い合わせください。</p>
        ) : (
          <p className="notice-box">公開前に実際に受信できるプライバシー窓口の設定が必要です。</p>
        )}
      </article>
    );
  }
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
        browser to one flower and one open report per grave. The visitor cookie expires one year after it is set.
        A language preference cookie stores the English or Japanese selection for one year.
      </p>

      <h2>Recovery links</h2>
      <p>
        A private recovery link can transfer editing access. The secret is placed after the <code>#</code> in the link,
        removed from the address bar after it is read, and stored only as a one-way hash on the server. Anyone with the
        full link can take over editing, so keep it private.
      </p>

      <h2>Payments and service providers</h2>
      {env.PAYMENTS_MODE === "off" ? (
        <p>
          Checkout is disabled in this public beta, so no new paid checkout can be started. If checkout is enabled,
          Polar will host it and handle billing information. Someday Cemetery will store only the provider references
          and order state needed to grant a Custom Headstone, reconcile refunds, and resolve payment trouble.
        </p>
      ) : (
        <p>
          Polar hosts checkout and handles billing information. Someday Cemetery stores only the provider references
          and order state needed to grant a Custom Headstone, reconcile refunds, and resolve payment trouble. Billing
          details are not transferred when grave ownership is restored.
        </p>
      )}

      <h2>Deletion and moderation</h2>
      <p>
        Deleting a grave immediately removes its title, parting words, start year, active grave owner reference,
        recovery hash, and flowers from the active service. A non-public tombstone record remains so the old URL and
        plot history are not silently reused. Reports and moderation records are retained to document safety decisions.
        Minimal payment and provider records may remain where needed for reconciliation, refunds, disputes, fraud
        prevention, and an audit trail. A hidden grave is removed from public responses but can still be edited by its
        owner. Copies already saved by others or cached outside this service may remain.
      </p>

      <h2>Retention</h2>
      <p>
        Public or hidden grave content, its recovery hash, and flower uniqueness hashes are kept until the grave is
        deleted. Create-request idempotency records expire after seven days, and rate-limit records expire at their
        recorded time; both are removed by daily maintenance. Resolved or dismissed reports and the corresponding
        report-decision logs are removed after one year. Open reports are kept until they are reviewed.
      </p>
      <p>
        An anonymous account that owns no live grave is eligible for deletion after 90 days. Accounts that still own a
        grave or are needed for payment or moderation records are retained. Non-public grave tombstones, other
        moderation records, and payment evidence do not currently have an automatic deletion date. Provider backups may
        contain older copies until their managed backup window expires.
      </p>

      <h2>Operator</h2>
      {env.OPERATOR_NAME ? (
        <p>{env.OPERATOR_NAME}</p>
      ) : (
        <p className="notice-box">A real operator identity must be configured before publication.</p>
      )}

      <h2>Contact</h2>
      {env.SUPPORT_EMAIL ? (
        <p>
          For privacy or deletion questions, contact <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a>.
        </p>
      ) : (
        <p className="notice-box">A real privacy contact must be configured before publication.</p>
      )}
    </article>
  );
}
