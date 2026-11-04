"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ClientApiError, useCemetery } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useI18n } from "@/components/language-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import { DESIGNS, type GraveAccent, type GraveStyle, type OwnerGraveDto } from "@/domain";
import { accentName, designCopy } from "@/i18n/presentation";

const styles: GraveStyle[] = ["classic", "moss", "wildflowers", "lantern"];
const CHECKOUT_CANCELLED_NOTICE = "__checkout_cancelled__";

function errorCode(error: unknown): string | undefined {
  if (error instanceof ClientApiError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

export function CustomizeExperience({ graveId }: { graveId: string }) {
  const searchParams = useSearchParams();
  const runtime = useRuntimeConfig();
  const cemetery = useCemetery();
  const { locale, t, localizeError } = useI18n();
  const [grave, setGrave] = useState<OwnerGraveDto | null | undefined>(undefined);
  const [selectedStyle, setSelectedStyle] = useState<GraveStyle>("classic");
  const [selectedAccent, setSelectedAccent] = useState<GraveAccent>("stone");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("checkout") === "cancelled" ? CHECKOUT_CANCELLED_NOTICE : null,
  );
  const [saved, setSaved] = useState(false);
  const loadedGraveId = useRef<string | null>(null);
  const previousLocale = useRef(locale);
  const displayedMessage = message === CHECKOUT_CANCELLED_NOTICE ? t("payment.cancel") : message;

  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setMessage((current) => current === CHECKOUT_CANCELLED_NOTICE ? current : null);
  }, [locale]);

  useEffect(() => {
    if (loadedGraveId.current === graveId) return;
    let active = true;
    cemetery.getOwnerGrave(graveId).then((value) => {
      if (!active) return;
      loadedGraveId.current = graveId;
      setGrave(value);
      if (value) {
        const pending = sessionStorage.getItem(`someday-cemetery:pending-style:${graveId}`) as GraveStyle | null;
        const nextStyle = pending && styles.includes(pending) ? pending : value.selectedStyle;
        setSelectedStyle(nextStyle);
        setSelectedAccent(
          nextStyle === value.selectedStyle && DESIGNS[nextStyle].accents.includes(value.selectedAccent)
            ? value.selectedAccent
            : DESIGNS[nextStyle].accents[0],
        );
      }
    }).catch(() => {
      if (!active) return;
      setGrave(null);
    });
    return () => { active = false; };
  }, [cemetery, graveId]);

  if (grave === undefined) {
    return (
      <div className="narrow-page state-page">
        {locale === "ja" ? "墓石を用意しています…" : "Preparing the headstones…"}
      </div>
    );
  }
  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">{locale === "ja" ? "編集権限が必要です" : "Owner access required"}</p>
        <h1>{locale === "ja" ? "自分の墓碑をカスタマイズしましょう。" : "Customize your own grave."}</h1>
        <p className="lede">
          {locale === "ja"
            ? "決済を開く前に、非公開リンクで編集権限を復旧してください。"
            : "Restore editing access with the private link before opening checkout."}
        </p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href="/recover">{t("recovery.action")}</Link>
          <Link className="button button-secondary" href={`/g/${graveId}`}>
            {locale === "ja" ? "墓碑に戻る" : "Back to the grave"}
          </Link>
        </div>
      </section>
    );
  }

  function chooseStyle(style: GraveStyle) {
    setSelectedStyle(style);
    setSelectedAccent(DESIGNS[style].accents[0]);
    setSaved(false);
    setMessage(null);
    if (style !== "classic") sessionStorage.setItem(`someday-cemetery:pending-style:${graveId}`, style);
  }

  async function applyDesign() {
    if (!grave) return;
    if (DESIGNS[selectedStyle].paid && !grave.hasActiveEntitlement) {
      setMessage(
        locale === "ja"
          ? "このプレビューを適用するには、3種類のカスタムデザインを解放してください。"
          : "Unlock the three custom designs before applying this preview.",
      );
      return;
    }
    setBusy(true);
    try {
      const updated = await cemetery.updateGrave(grave.id, {
        title: grave.title,
        epitaph: grave.epitaph,
        startedYear: grave.startedYear,
        selectedStyle,
        accent: selectedAccent,
        version: grave.version,
      });
      setGrave(updated);
      setSaved(true);
      sessionStorage.removeItem(`someday-cemetery:pending-style:${graveId}`);
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? localizeError(requestError.message, errorCode(requestError))
          : t("error.network"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    if (!grave) return;
    sessionStorage.setItem(`someday-cemetery:pending-style:${graveId}`, selectedStyle);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/graves/${grave.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const result = (await response.json()) as {
        kind?: "checkout" | "already_active";
        checkoutUrl?: string;
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new ClientApiError(
          result.code ?? "CHECKOUT_FAILED",
          result.message ?? (locale === "ja" ? "現在、決済を利用できません。" : "Checkout is unavailable."),
          response.status,
        );
      }
      if (result.kind === "already_active") {
        const refreshed = await cemetery.getOwnerGrave(grave.id);
        if (refreshed) setGrave(refreshed);
        setMessage(
          locale === "ja"
            ? "この墓碑では、すでにカスタム墓石を利用できます。"
            : "This grave already has its custom headstones.",
        );
        return;
      }
      if (!result.checkoutUrl) {
        throw new Error(
          locale === "ja" ? "決済ページのURLを取得できませんでした。" : "The hosted checkout URL was not returned.",
        );
      }
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? localizeError(requestError.message, errorCode(requestError))
          : t("error.network"),
      );
      setBusy(false);
    }
  }

  const preview = { ...grave, style: selectedStyle, accent: selectedAccent };
  const canPurchase = runtime.paymentsMode !== "off" && runtime.dataBackend === "supabase";
  const selectedDesign = designCopy(selectedStyle, locale);

  return (
    <section className="wide-page customize-page">
      <header className="customize-header">
        <div>
          <p className="eyebrow">{t("upgrade.title")}</p>
          <h1>{locale === "ja" ? "眠り方を選びましょう。" : "Choose how it rests."}</h1>
          <p className="lede">
            {locale === "ja"
              ? "クラシックの石はいつでも無料です。1回の購入で、この墓碑の追加デザイン3種類をすべて解放できます。"
              : "The classic stone is always free. One purchase unlocks all three additional designs for this grave."}
          </p>
        </div>
        <Link className="button button-secondary" href={`/g/${grave.id}`}>
          {locale === "ja" ? "墓碑に戻る" : "Back to the grave"}
        </Link>
      </header>

      <div className="customize-layout">
        <div className="customize-preview panel">
          <span className="pill">
            {grave.hasActiveEntitlement || selectedStyle === "classic"
              ? locale === "ja" ? "利用可能" : "Available"
              : locale === "ja" ? "プレビュー" : "Preview"}
          </span>
          <Gravestone grave={preview} />
          <h2>{selectedDesign.name}</h2>
          <p>{selectedDesign.description}</p>
          <div className="accent-picker" aria-label={locale === "ja" ? "色を選ぶ" : "Choose a color"}>
            {DESIGNS[selectedStyle].accents.map((accent) => (
              <button
                key={accent}
                type="button"
                className={`accent-swatch accent-${accent}`}
                aria-label={
                  locale === "ja"
                    ? `${accentName(accent, locale)}を使う`
                    : `Use ${accentName(accent, locale)}`
                }
                aria-pressed={selectedAccent === accent}
                onClick={() => setSelectedAccent(accent)}
              />
            ))}
          </div>
        </div>

        <div className="design-chooser">
          <div className="design-grid">
            {styles.map((style) => {
              const design = DESIGNS[style];
              const localizedDesign = designCopy(style, locale);
              return (
                <button
                  key={style}
                  className={`design-option ${selectedStyle === style ? "design-option-selected" : ""}`}
                  type="button"
                  onClick={() => chooseStyle(style)}
                  aria-pressed={selectedStyle === style}
                >
                  <span className={`design-mini design-mini-${style}`} aria-hidden="true" />
                  <span>
                    <strong>{localizedDesign.name}</strong>
                    <small>{design.paid ? locale === "ja" ? "カスタム" : "Custom" : locale === "ja" ? "無料" : "Free"}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <section className="purchase-card card">
            <div className="purchase-card-heading">
              <div>
                <p className="eyebrow">{locale === "ja" ? "カスタム墓石" : "Custom Headstone"}</p>
                <h2>{t("upgrade.price")}</h2>
              </div>
              <span className="purchase-price">$7</span>
            </div>
            <ul>
              <li>{locale === "ja" ? "この墓碑で苔、野の花、ランタンを利用可能" : "Moss, Wildflowers, and Lantern for this grave"}</li>
              <li>{locale === "ja" ? "3種類をいつでも切り替え可能" : "Switch between all three whenever you like"}</li>
              <li>{locale === "ja" ? "2400 × 1260の高解像度記念画像" : "2400 × 1260 high-resolution keepsake"}</li>
              <li>{locale === "ja" ? "表示順位や優先掲載には影響しません" : "No ranking or priority placement"}</li>
            </ul>
            <p className="tiny muted">
              {t("upgrade.tax")}{" "}
              {locale === "ja"
                ? "デザインはサービスの運営中に利用でき、ダウンロードした画像は手元に残せます。"
                : "Designs are available while the service operates; downloaded images stay with you."}
            </p>
            {displayedMessage ? <p className="notice-box" role="status">{displayedMessage}</p> : null}
            {saved ? <p className="success-message">{locale === "ja" ? "墓石を更新しました。" : "Headstone updated."}</p> : null}
            {grave.hasActiveEntitlement ? (
              <div className="actions">
                <button className="button button-primary" type="button" onClick={applyDesign} disabled={busy}>
                  {busy ? locale === "ja" ? "保存しています…" : "Saving…" : locale === "ja" ? "このデザインを適用" : "Apply this design"}
                </button>
                <a className="button button-secondary" href={`/api/graves/${grave.id}/keepsake?locale=${locale}`}>{t("upgrade.download")}</a>
              </div>
            ) : selectedStyle === "classic" ? (
              <button className="button button-primary" type="button" onClick={applyDesign} disabled={busy}>
                {locale === "ja" ? "無料のクラシック墓石を使う" : "Use the free Classic stone"}
              </button>
            ) : (
              <button className="button button-primary" type="button" onClick={startCheckout} disabled={busy || !canPurchase}>
                {busy ? locale === "ja" ? "安全な決済ページを開いています…" : "Opening secure checkout…" : t("upgrade.buy")}
              </button>
            )}
            {!grave.hasActiveEntitlement && !canPurchase ? (
              <p className="tiny muted">
                {runtime.dataBackend === "demo"
                  ? locale === "ja"
                    ? "ローカルデモでは、カスタムデザインはプレビューのみです。購入処理は行われません。"
                    : "Custom designs are preview-only in the local demo. No purchase is simulated."
                  : locale === "ja"
                    ? "現在、新規購入は停止しています。購入済みのカスタム墓石は引き続き利用できます。"
                    : "New purchases are currently off. Existing Custom Headstones remain available."}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
