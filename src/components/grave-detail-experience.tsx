"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ClientApiError, useCemetery } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useI18n } from "@/components/language-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { countGraphemes, type OwnerGraveDto, type PublicGraveDto } from "@/domain";
import { downloadDemoImage } from "@/demo";
import { gardenName } from "@/i18n/presentation";

const reportReasons = ["spam", "harassment", "personal_information", "real_person", "other"] as const;

function errorCode(error: unknown): string | undefined {
  if (error instanceof ClientApiError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

export function GraveDetailExperience({ graveId }: { graveId: string }) {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const cemetery = useCemetery();
  const { locale, t, localizeError, formatDate, formatNumber } = useI18n();
  const [grave, setGrave] = useState<PublicGraveDto | null | undefined>(undefined);
  const [ownerGrave, setOwnerGrave] = useState<OwnerGraveDto | null>(null);
  const [flowerBusy, setFlowerBusy] = useState(false);
  const [flowerDone, setFlowerDone] = useState(false);
  const [shared, setShared] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const previousLocale = useRef(locale);
  const reportDetailsLength = countGraphemes(reportDetails);

  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setMessage(null);
  }, [locale]);

  useEffect(() => {
    let active = true;
    Promise.all([cemetery.getGrave(graveId), cemetery.getOwnerGrave(graveId)])
      .then(([publicGrave, owned]) => {
        if (!active) return;
        setGrave(publicGrave);
        setOwnerGrave(owned);
      })
      .catch((loadError) => {
        if (!active) return;
        setGrave(null);
        setMessage(
          loadError instanceof Error
            ? localizeError(loadError.message, errorCode(loadError))
            : t("error.network"),
        );
      });
    return () => { active = false; };
  }, [cemetery, graveId, localizeError, t]);

  useEffect(() => {
    if (reportOpen) reportDialog.current?.showModal();
    else reportDialog.current?.close();
  }, [reportOpen]);

  if (grave === undefined) {
    return (
      <div className="narrow-page state-page">
        {locale === "ja" ? "小道の先を確かめています…" : "The path is coming into view…"}
      </div>
    );
  }

  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">{locale === "ja" ? "空いている区画" : "An empty plot"}</p>
        <h1>{t("error.unavailable")}</h1>
        {message ? <p className="lede">{message}</p> : null}
        <Link className="button button-primary" href="/">{t("action.explore")}</Link>
      </section>
    );
  }

  const buriedDate = formatDate(grave.buriedAt, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const reportReasonLabels: Record<(typeof reportReasons)[number], string> = locale === "ja"
    ? {
        spam: "スパム",
        harassment: "嫌がらせまたは脅迫",
        personal_information: "個人情報",
        real_person: "実在の人物または他人の作品",
        other: "その他",
      }
    : {
        spam: "Spam",
        harassment: "Harassment or threat",
        personal_information: "Personal information",
        real_person: "A real person or somebody else’s work",
        other: "Other",
      };

  async function leaveFlower() {
    if (!grave) return;
    setFlowerBusy(true);
    setMessage(null);
    try {
      const result = await cemetery.leaveFlower(grave.id);
      setGrave({ ...grave, flowerCount: result.flowerCount });
      setFlowerDone(true);
    } catch (flowerError) {
      setMessage(
        flowerError instanceof Error
          ? localizeError(flowerError.message, errorCode(flowerError))
          : t("error.network"),
      );
    } finally {
      setFlowerBusy(false);
    }
  }

  async function sharePublicLink() {
    if (!grave) return;
    const url = `${window.location.origin}/g/${grave.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${grave.title} — Someday Cemetery`, text: grave.epitaph, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 1800);
  }

  async function downloadImage() {
    if (!grave) return;
    if (runtime.dataBackend === "demo") await downloadDemoImage(grave, locale);
    else {
      const anchor = document.createElement("a");
      anchor.href = `/api/graves/${grave.id}/image?locale=${locale}`;
      anchor.download = `someday-cemetery-${grave.id}.png`;
      anchor.click();
    }
  }

  async function sendReport(event: React.FormEvent) {
    event.preventDefault();
    if (!grave) return;
    setReportBusy(true);
    try {
      await cemetery.report(grave.id, reportReason, reportDetails || undefined, turnstileToken ?? undefined);
      setReportDone(true);
      setTimeout(() => setReportOpen(false), 900);
    } catch (reportError) {
      setMessage(
        reportError instanceof Error
          ? localizeError(reportError.message, errorCode(reportError))
          : t("error.network"),
      );
    } finally {
      setReportBusy(false);
    }
  }

  async function nextGrave() {
    setMessage(null);
    try {
      const next = await cemetery.randomGrave();
      if (next) router.push(`/g/${next.id}`);
      else setMessage(locale === "ja" ? "訪れられる墓碑がまだありません。" : "There are no graves to visit yet.");
    } catch (nextError) {
      setMessage(
        nextError instanceof Error
          ? localizeError(nextError.message, errorCode(nextError))
          : t("error.network"),
      );
    }
  }

  return (
    <article className="grave-page wide-page">
      <section
        className="grave-scene"
        aria-label={locale === "ja" ? `${grave.title}の墓碑` : `Memorial for ${grave.title}`}
      >
        <div className="grave-scene-moon" aria-hidden="true" />
        <div className="grave-scene-trees" aria-hidden="true"><i /><i /><i /></div>
        <div className="grave-scene-stone">
          <Gravestone grave={grave} />
          {!grave.isExample ? (
            <div
              className="scene-flowers"
              aria-label={
                locale === "ja"
                  ? `${formatNumber(grave.flowerCount)}輪の花が手向けられています`
                  : `${formatNumber(grave.flowerCount)} ${grave.flowerCount === 1 ? "flower" : "flowers"} left`
              }
            >
              {Array.from({ length: Math.min(5, grave.flowerCount) }, (_, index) => <span key={index}>✿</span>)}
            </div>
          ) : null}
        </div>
        <div className="grave-scene-ground" aria-hidden="true" />
        {grave.isExample ? <span className="badge badge-example scene-example">{t("example.badge")}</span> : null}
      </section>

      <section className="grave-reading">
        <div className="grave-location-row">
          <p className="eyebrow">
            {gardenName(grave.gardenOrdinal ?? 1, locale)} · {locale === "ja" ? "区画" : "Plot"}{" "}
            {formatNumber(grave.plotIndex + 1)}
          </p>
          {ownerGrave ? <span className="pill">{locale === "ja" ? "あなたの墓碑" : "Yours"}</span> : null}
        </div>
        <h1>{grave.title}</h1>
        {grave.epitaph ? <blockquote>{grave.epitaph}</blockquote> : null}
        <dl className="grave-dates">
          {grave.startedYear ? <div><dt>{t("grave.started")}</dt><dd>{formatNumber(grave.startedYear, { useGrouping: false })}</dd></div> : null}
          <div><dt>{t("grave.buried")}</dt><dd>{buriedDate}</dd></div>
          {!grave.isExample ? <div><dt>{locale === "ja" ? "花" : "Flowers"}</dt><dd>{formatNumber(grave.flowerCount)}</dd></div> : null}
        </dl>

        {message ? <p className="error-message" role="alert">{message}</p> : null}
        <div className="grave-actions">
          {!grave.isExample ? (
            <button className="button button-primary" type="button" onClick={leaveFlower} disabled={flowerBusy || flowerDone}>
              <span aria-hidden="true">✿</span>
              {flowerDone
                ? t("flower.done")
                : flowerBusy
                  ? locale === "ja" ? "花を手向けています…" : "Placing a flower…"
                  : t("flower.action")}
            </button>
          ) : null}
          <button className="button button-secondary" type="button" onClick={sharePublicLink}>
            {shared ? t("share.copied") : t("share.public")}
          </button>
          <button className="button button-secondary" type="button" onClick={downloadImage}>{t("share.image")}</button>
        </div>

        {ownerGrave ? (
          <div className="owner-actions card">
            <div>
              <p className="field-label">
                {locale === "ja" ? "このブラウザに編集権限があります" : "This grave belongs to this browser"}
              </p>
              <p>
                {locale === "ja"
                  ? "言葉を編集したり、復旧リンクを保存したり、別の墓石を試したりできます。"
                  : "Edit the words, keep a recovery link, or preview another headstone."}
              </p>
            </div>
            <div className="actions">
              <Link className="button button-secondary" href={`/g/${grave.id}/edit`}>{t("owner.edit")}</Link>
              <Link className="button button-secondary" href={`/g/${grave.id}/customize`}>
                {locale === "ja" ? "カスタマイズ" : "Customize"}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grave-secondary-actions">
          <button className="text-button" type="button" onClick={nextGrave}>
            {locale === "ja" ? "別の墓碑を訪れる →" : "Visit another grave →"}
          </button>
          {!grave.isExample ? (
            <button className="text-button muted" type="button" onClick={() => setReportOpen(true)}>{t("report.action")}</button>
          ) : null}
        </div>
      </section>

      <dialog
        className="report-dialog"
        ref={reportDialog}
        onClose={() => setReportOpen(false)}
        onCancel={() => setReportOpen(false)}
      >
        <form method="dialog" className="dialog-close-row">
          <button className="icon-button" value="cancel" aria-label={locale === "ja" ? "通報フォームを閉じる" : "Close report form"}>×</button>
        </form>
        <form onSubmit={sendReport}>
          <p className="eyebrow">{locale === "ja" ? "非公開の通報" : "Private report"}</p>
          <h2>{locale === "ja" ? "問題の内容をお知らせください。" : "Tell us what is wrong."}</h2>
          {reportDone ? (
            <p className="success-message">{t("report.success")}</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="report-reason">{locale === "ja" ? "理由" : "Reason"}</label>
                <select className="select" id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)}>
                  {reportReasons.map((value) => <option key={value} value={value}>{reportReasonLabels[value]}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="field-row">
                  <label htmlFor="report-details">{locale === "ja" ? "詳細（任意）" : "Details, optional"}</label>
                  <span>{formatNumber(reportDetailsLength)}/500</span>
                </div>
                <textarea
                  className="textarea"
                  id="report-details"
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  aria-invalid={reportDetailsLength > 500}
                />
                {reportDetailsLength > 500 ? (
                  <p className="field-error">{locale === "ja" ? "500文字以内で入力してください。" : "Use 500 characters or fewer."}</p>
                ) : null}
              </div>
              {runtime.turnstileSiteKey ? <TurnstileWidget siteKey={runtime.turnstileSiteKey} onToken={setTurnstileToken} /> : null}
              <p className="tiny muted">
                {locale === "ja"
                  ? "通報内容は公開されません。通報だけで墓碑が自動的に非表示になることはありません。"
                  : "Reports are not public. A report does not automatically hide a grave."}
              </p>
              <button className="button button-primary" type="submit" disabled={reportBusy || reportDetailsLength > 500 || Boolean(runtime.turnstileSiteKey && !turnstileToken)}>
                {reportBusy ? locale === "ja" ? "送信しています…" : "Sending…" : locale === "ja" ? "通報を送信" : "Send report"}
              </button>
            </>
          )}
        </form>
      </dialog>
    </article>
  );
}
