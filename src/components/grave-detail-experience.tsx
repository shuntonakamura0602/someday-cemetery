"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCemetery } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useRuntimeConfig } from "@/components/runtime-config";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { countGraphemes, t, type OwnerGraveDto, type PublicGraveDto } from "@/domain";
import { downloadDemoImage } from "@/demo";

const reportReasons = [
  ["spam", "Spam"],
  ["harassment", "Harassment or threat"],
  ["personal_information", "Personal information"],
  ["real_person", "A real person or somebody else’s work"],
  ["other", "Other"],
] as const;

export function GraveDetailExperience({ graveId }: { graveId: string }) {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const cemetery = useCemetery();
  const [grave, setGrave] = useState<PublicGraveDto | null | undefined>(undefined);
  const [ownerGrave, setOwnerGrave] = useState<OwnerGraveDto | null>(null);
  const [flowerBusy, setFlowerBusy] = useState(false);
  const [flowerDone, setFlowerDone] = useState(false);
  const [shared, setShared] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number][0]>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const reportDetailsLength = countGraphemes(reportDetails);

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
        setMessage(loadError instanceof Error ? loadError.message : t("error.network"));
      });
    return () => { active = false; };
  }, [cemetery, graveId]);

  useEffect(() => {
    if (reportOpen) reportDialog.current?.showModal();
    else reportDialog.current?.close();
  }, [reportOpen]);

  if (grave === undefined) {
    return <div className="narrow-page state-page">The path is coming into view…</div>;
  }

  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">An empty plot</p>
        <h1>{t("error.unavailable")}</h1>
        {message ? <p className="lede">{message}</p> : null}
        <Link className="button button-primary" href="/">Explore the cemetery</Link>
      </section>
    );
  }

  const buriedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(grave.buriedAt));

  async function leaveFlower() {
    if (!grave) return;
    setFlowerBusy(true);
    setMessage(null);
    try {
      const result = await cemetery.leaveFlower(grave.id);
      setGrave({ ...grave, flowerCount: result.flowerCount });
      setFlowerDone(true);
    } catch (flowerError) {
      setMessage(flowerError instanceof Error ? flowerError.message : t("error.network"));
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
    if (runtime.dataBackend === "demo") await downloadDemoImage(grave);
    else {
      const anchor = document.createElement("a");
      anchor.href = `/api/graves/${grave.id}/image`;
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
      setMessage(reportError instanceof Error ? reportError.message : t("error.network"));
    } finally {
      setReportBusy(false);
    }
  }

  async function nextGrave() {
    const next = await cemetery.randomGrave();
    if (next) router.push(`/g/${next.id}`);
  }

  return (
    <article className="grave-page wide-page">
      <section className="grave-scene" aria-label={`Memorial for ${grave.title}`}>
        <div className="grave-scene-moon" aria-hidden="true" />
        <div className="grave-scene-trees" aria-hidden="true"><i /><i /><i /></div>
        <div className="grave-scene-stone">
          <Gravestone grave={grave} />
          {!grave.isExample ? (
            <div className="scene-flowers" aria-label={`${grave.flowerCount} flowers left`}>
              {Array.from({ length: Math.min(5, grave.flowerCount) }, (_, index) => <span key={index}>✿</span>)}
            </div>
          ) : null}
        </div>
        <div className="grave-scene-ground" aria-hidden="true" />
        {grave.isExample ? <span className="badge badge-example scene-example">Example</span> : null}
      </section>

      <section className="grave-reading">
        <div className="grave-location-row">
          <p className="eyebrow">Garden {grave.gardenOrdinal ?? 1} · Plot {grave.plotIndex + 1}</p>
          {ownerGrave ? <span className="pill">Yours</span> : null}
        </div>
        <h1>{grave.title}</h1>
        {grave.epitaph ? <blockquote>{grave.epitaph}</blockquote> : null}
        <dl className="grave-dates">
          {grave.startedYear ? <div><dt>Started</dt><dd>{grave.startedYear}</dd></div> : null}
          <div><dt>Laid to rest</dt><dd>{buriedDate}</dd></div>
          {!grave.isExample ? <div><dt>Flowers</dt><dd>{grave.flowerCount}</dd></div> : null}
        </dl>

        {message ? <p className="error-message" role="alert">{message}</p> : null}
        <div className="grave-actions">
          {!grave.isExample ? (
            <button className="button button-primary" type="button" onClick={leaveFlower} disabled={flowerBusy || flowerDone}>
              <span aria-hidden="true">✿</span>
              {flowerDone ? t("flower.done") : flowerBusy ? "Placing a flower…" : t("flower.action")}
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
              <p className="field-label">This grave belongs to this browser</p>
              <p>Edit the words, keep a recovery link, or preview another headstone.</p>
            </div>
            <div className="actions">
              <Link className="button button-secondary" href={`/g/${grave.id}/edit`}>Edit this grave</Link>
              <Link className="button button-secondary" href={`/g/${grave.id}/customize`}>Customize</Link>
            </div>
          </div>
        ) : null}

        <div className="grave-secondary-actions">
          <button className="text-button" type="button" onClick={nextGrave}>Visit another grave →</button>
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
          <button className="icon-button" value="cancel" aria-label="Close report form">×</button>
        </form>
        <form onSubmit={sendReport}>
          <p className="eyebrow">Private report</p>
          <h2>Tell us what is wrong.</h2>
          {reportDone ? (
            <p className="success-message">{t("report.success")}</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="report-reason">Reason</label>
                <select className="select" id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)}>
                  {reportReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="field-row"><label htmlFor="report-details">Details, optional</label><span>{reportDetailsLength}/500</span></div>
                <textarea
                  className="textarea"
                  id="report-details"
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  aria-invalid={reportDetailsLength > 500}
                />
                {reportDetailsLength > 500 ? <p className="field-error">Use 500 characters or fewer.</p> : null}
              </div>
              {runtime.turnstileSiteKey ? <TurnstileWidget siteKey={runtime.turnstileSiteKey} onToken={setTurnstileToken} /> : null}
              <p className="tiny muted">Reports are not public. A report does not automatically hide a grave.</p>
              <button className="button button-primary" type="submit" disabled={reportBusy || reportDetailsLength > 500 || Boolean(runtime.turnstileSiteKey && !turnstileToken)}>{reportBusy ? "Sending…" : "Send report"}</button>
            </>
          )}
        </form>
      </dialog>
    </article>
  );
}
