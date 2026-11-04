import type { Locale } from "./config";

const japaneseErrors: Record<string, string> = {
  ALREADY_ENTITLED: "この墓碑では、すでに有料デザインを利用できます。",
  AUTH_NOT_CONFIGURED: "管理者認証が設定されていません。",
  AUTH_REQUIRED: "続けるには認証が必要です。",
  AUTH_UNAVAILABLE: "匿名認証を利用できません。しばらくしてからもう一度お試しください。",
  BOT_CHECK_FAILED: "ボット確認に失敗しました。もう一度お試しください。",
  BOT_CHECK_REQUIRED: "続けるにはボット確認を完了してください。",
  BOT_PROTECTION_UNAVAILABLE: "ボット対策を利用できません。しばらくしてからもう一度お試しください。",
  CHECKOUT_CREATE_UNCERTAIN: "決済の開始結果を確認できませんでした。重複購入を避けるため、もう一度押さずに状態をご確認ください。",
  CHECKOUT_FAILED: "現在、決済を開始できません。しばらくしてからもう一度お試しください。",
  CHECKOUT_ID_MISSING: "決済情報を確認できませんでした。運営者へお問い合わせください。",
  CHECKOUT_TERMS_MISMATCH: "決済内容を確認できないため、購入を完了できませんでした。",
  DATABASE_ERROR: "データベースとの通信に失敗しました。しばらくしてからもう一度お試しください。",
  DATABASE_NOT_CONFIGURED: "データベースが設定されていません。運営者へお問い合わせください。",
  DEMO_CLIENT_ONLY: "この機能はローカルデモのブラウザ内でのみ利用できます。",
  ENTITLEMENT_REQUIRED: "この機能を利用するには有料デザインの購入が必要です。",
  FORBIDDEN: "この操作を行う権限がありません。",
  GARDEN_UNAVAILABLE: "この庭は現在利用できません。",
  GRAVE_NOT_FOUND: "この墓碑は見つかりませんでした。",
  GRAVE_UNAVAILABLE: "この墓碑は現在利用できません。",
  IDEMPOTENCY_CONFLICT: "同じ送信識別子が別の内容ですでに使われています。",
  IDEMPOTENCY_KEY_REQUIRED: "送信識別子がありません。もう一度お試しください。",
  INVALID_CURSOR: "読み込み位置が無効です。",
  INVALID_INPUT: "入力内容を確認してください。",
  INVALID_ORIGIN: "このページからは操作できません。",
  INVALID_RECOVERY: "この復旧リンクは無効か、すでに置き換えられています。",
  INVALID_SERVER_CONFIG: "サーバー設定に問題があります。運営者へお問い合わせください。",
  MULTIPLE_ORDERS_FOR_CHECKOUT: "この決済に複数の注文が見つかったため、運営者による確認が必要です。",
  NO_STATE_CHANGE: "変更はありませんでした。",
  PAYMENTS_DISABLED: "現在、購入は停止しています。",
  PAYMENTS_NOT_CONFIGURED: "決済はまだ設定されていません。",
  PAYMENT_REQUIRED: "このデザインを保存するには購入が必要です。",
  PLOT_TAKEN: "別の人がこの区画を選びました。下書きは残っています。別の場所を選んでください。",
  PURCHASE_NOT_FOUND: "購入情報が見つかりませんでした。",
  PURCHASE_INTENT_NOT_FOUND: "購入手続きの情報が見つかりませんでした。",
  PURCHASE_REVIEW_REQUIRED: "この購入は運営者による確認が必要です。",
  PURCHASE_UNAVAILABLE: "現在、この購入情報を利用できません。",
  RATE_LIMITED: "少し時間をおいてから、もう一度お試しください。",
  RECOVERY_INVALID: "この復旧リンクは無効か、すでに置き換えられています。",
  REQUEST_FAILED: "問題が発生しました。下書きは残っています。もう一度お試しください。",
  SERVICE_UNAVAILABLE: "サービスを一時的に利用できません。しばらくしてからもう一度お試しください。",
  PROVIDER_ORDER_PROCESSING_FAILED: "決済事業者の注文を処理できませんでした。運営者による確認が必要です。",
  PROVIDER_RECONCILIATION_FAILED: "決済事業者との照合に失敗しました。しばらくしてからもう一度お試しください。",
  SUCCEEDED_CHECKOUT_WITHOUT_ORDER: "決済結果を確認できませんでした。重複購入せず、運営者へお問い合わせください。",
  VERSION_CONFLICT: "この墓碑は別の場所で更新されています。最新の内容を確認してから保存してください。",
  WEBHOOK_NOT_CONFIGURED: "決済通知が設定されていません。運営者へお問い合わせください。",
};

const japaneseMessageMap: Record<string, string> = {
  "Enter a project name.": "プロジェクト名を入力してください。",
  "Use 48 characters or fewer.": "48文字以内で入力してください。",
  "Use 160 characters or fewer.": "160文字以内で入力してください。",
  "Use no more than 3 lines.": "3行以内で入力してください。",
  "Do not include contact details or links.": "連絡先やリンクは含めないでください。",
  "Choose a color offered for this design.": "このデザインで利用できる色を選んでください。",
  "Something went wrong. Your draft is safe. Please try again.":
    "問題が発生しました。下書きは残っています。もう一度お試しください。",
  "The garden could not be loaded.": "庭を読み込めませんでした。",
  "This grave isn’t available.": "この墓碑は現在利用できません。",
  "This recovery link is invalid or has been replaced.":
    "この復旧リンクは無効か、すでに置き換えられています。",
  "You do not own this grave in this browser.": "このブラウザには、この墓碑の編集権限がありません。",
  "Paid designs are preview-only in the local demo.": "ローカルデモでは、有料デザインはプレビューのみ利用できます。",
};

const networkErrorPattern = /^(failed to fetch|fetch failed|load failed|network request failed|networkerror when attempting to fetch resource\.?|the network connection was lost\.?)$/i;
const japaneseTextPattern = /[\u3040-\u30ff\u3400-\u9fff]/;

export function localizeMessage(locale: Locale, message: string, code?: string): string {
  if (locale === "en") return message;
  if (code && japaneseErrors[code]) return japaneseErrors[code];
  if (networkErrorPattern.test(message.trim())) {
    return "ネットワークに接続できませんでした。接続を確認して、もう一度お試しください。";
  }
  if (japaneseMessageMap[message]) return japaneseMessageMap[message];
  if (japaneseTextPattern.test(message)) return message;
  return "問題が発生しました。もう一度お試しください。";
}

export function localizeFieldErrors(
  locale: Locale,
  fieldErrors?: Record<string, string[]>,
): Record<string, string[]> | undefined {
  if (!fieldErrors || locale === "en") return fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages.map((message) => localizeMessage(locale, message)),
    ]),
  );
}
