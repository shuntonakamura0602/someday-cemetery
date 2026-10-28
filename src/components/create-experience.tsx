"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZodError } from "zod";

import { CemeteryMap } from "@/components/cemetery/cemetery-map";
import { useCemetery, ClientApiError } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useRuntimeConfig } from "@/components/runtime-config";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  countGraphemes,
  parseCreateGraveInput,
  t,
  type CreatedGraveResult,
  type PublicGraveDto,
} from "@/domain";
import { clearDraft, loadDraft, saveDraft, type DemoDraft } from "@/demo";

const blankDraft: DemoDraft = { title: "", epitaph: "", startedYear: "" };

export function CreateExperience() {
  const searchParams = useSearchParams();
  const cemetery = useCemetery();
  const runtime = useRuntimeConfig();
  const [draft, setDraft] = useState<DemoDraft>(blankDraft);
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  const [gardenId, setGardenId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedGraveResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const idempotencyKey = useRef(crypto.randomUUID());
  const hydrated = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadDraft();
      const requestedPlotParam = searchParams.get("plot");
      const requestedPlot = requestedPlotParam === null ? Number.NaN : Number(requestedPlotParam);
      setDraft(stored);
      if (Number.isInteger(requestedPlot) && requestedPlot >= 0 && requestedPlot < 100) {
        setSelectedPlot(requestedPlot);
      } else if (stored.plotIndex !== undefined) setSelectedPlot(stored.plotIndex);
      setGardenId(searchParams.get("garden") || stored.gardenId || null);
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const effectiveGardenId = gardenId ?? cemetery.currentGarden?.id ?? null;

  useEffect(() => {
    if (!hydrated.current || created) return;
    saveDraft({ ...draft, gardenId: effectiveGardenId ?? undefined, plotIndex: selectedPlot ?? undefined });
  }, [created, draft, effectiveGardenId, selectedPlot]);

  useEffect(() => {
    if (!gardenId || cemetery.currentGarden?.id === gardenId) return;
    if (cemetery.gardens.some((garden) => garden.id === gardenId)) void cemetery.selectGarden(gardenId);
  }, [cemetery, gardenId]);

  const preview = useMemo<PublicGraveDto>(
    () => ({
      id: "preview",
      gardenId: effectiveGardenId ?? "preview",
      gardenOrdinal: cemetery.currentGarden?.ordinal ?? 1,
      plotIndex: selectedPlot ?? 0,
      title: draft.title.trim() || "Your unfinished thing",
      epitaph: draft.epitaph.trim() || undefined,
      startedYear: /^\d{4}$/.test(draft.startedYear) ? Number(draft.startedYear) : undefined,
      buriedAt: new Date().toISOString(),
      style: "classic",
      accent: "stone",
      flowerCount: 0,
      isExample: false,
    }),
    [cemetery.currentGarden?.ordinal, draft, effectiveGardenId, selectedPlot],
  );

  function updateDraft<K extends keyof DemoDraft>(key: K, value: DemoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: [] }));
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});
    if (!effectiveGardenId || selectedPlot === null) {
      setMessage("Choose a resting place before continuing.");
      document.querySelector("#plot-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    let input;
    try {
      input = parseCreateGraveInput({
        gardenId: effectiveGardenId,
        plotIndex: selectedPlot,
        title: draft.title,
        epitaph: draft.epitaph,
        startedYear: draft.startedYear,
      });
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const next: Record<string, string[]> = {};
        validationError.issues.forEach((issue) => {
          const field = String(issue.path[0] ?? "form");
          next[field] = [...(next[field] ?? []), issue.message];
        });
        setFieldErrors(next);
      }
      return;
    }

    setSubmitting(true);
    try {
      const result = await cemetery.createGrave(input, idempotencyKey.current, captchaToken ?? undefined);
      clearDraft();
      setCreated(result);
    } catch (requestError) {
      const code =
        requestError instanceof ClientApiError
          ? requestError.code
          : requestError instanceof Error && "code" in requestError
            ? String(requestError.code)
            : "";
      if (requestError instanceof ClientApiError && requestError.fieldErrors) setFieldErrors(requestError.fieldErrors);
      if (code === "AUTH_UNAVAILABLE") {
        setCaptchaToken(null);
        setCaptchaAttempt((attempt) => attempt + 1);
      }
      if (code === "PLOT_TAKEN") {
        setSelectedPlot(null);
        setMessage(t("error.plotTaken"));
      } else {
        setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPublicLink() {
    if (!created) return;
    await navigator.clipboard.writeText(`${window.location.origin}/g/${created.grave.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function saveRecoveryLink() {
    if (!created?.recoveryUrl) return;
    const blob = new Blob(
      [`Someday Cemetery private recovery link\n\n${created.recoveryUrl}\n\nAnyone with this link can take over editing this grave. Keep it private.\n`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `someday-cemetery-recovery-${created.grave.id}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (created) {
    return (
      <section className="created-page wide-page">
        <div className="burial-scene" aria-hidden="true">
          <div className="burial-light" />
          <Gravestone grave={created.grave} />
          <div className="burial-earth" />
        </div>
        <div className="created-copy">
          <p className="eyebrow">Laid to rest</p>
          <h1>{t("grave.created")}</h1>
          <p className="lede">Its public place is ready. The private link below is the only portable key to editing it.</p>
          <div className="created-links">
            <section className="card created-link-card">
              <p className="field-label">Public link</p>
              <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/g/${created.grave.id}`}</code>
              <button className="button button-secondary" type="button" onClick={copyPublicLink}>
                {copied ? t("share.copied") : t("share.public")}
              </button>
            </section>
            {created.recoveryUrl ? (
              <section className="card created-link-card recovery-card">
                <p className="field-label">Private recovery link</p>
                <p>{t("recovery.warning")}</p>
                <code className="secret-code">{created.recoveryUrl}</code>
                <button className="button button-primary" type="button" onClick={saveRecoveryLink}>
                  {t("recovery.save")}
                </button>
                <p className="tiny muted">{t("recovery.explanation")}</p>
              </section>
            ) : (
              <section className="notice-box">
                <p>This was a safe retry of an earlier request. Open the edit page to issue a fresh private recovery link.</p>
              </section>
            )}
          </div>
          <div className="actions">
            <Link className="button button-primary" href={`/g/${created.grave.id}`}>Visit the grave</Link>
            <Link className="button button-secondary" href={`/g/${created.grave.id}/customize`}>Preview custom headstones</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="create-page wide-page">
      <header className="create-header">
        <p className="eyebrow">A small ending</p>
        <h1>Lay something to rest.</h1>
        <p className="lede">Choose a quiet plot. Give the unfinished thing its name. Parting words are optional.</p>
      </header>

      <section className="create-grid">
        <div className="plot-picker" id="plot-picker">
          <div className="subsection-heading">
            <div>
              <p className="step-number">01</p>
              <h2>{t("plot.choose")}</h2>
            </div>
            <span className="pill">
              {selectedPlot === null ? "No plot chosen" : `Plot ${selectedPlot + 1}`}
            </span>
          </div>
          {cemetery.loading ? <div className="map-loading">The open plots are coming into view…</div> : null}
          {!cemetery.loading && cemetery.currentGarden ? (
            <CemeteryMap
              plots={cemetery.plots}
              selectable
              selectedPlot={selectedPlot}
              onSelectPlot={(plotIndex) => {
                setSelectedPlot(plotIndex);
                setGardenId(cemetery.currentGarden?.id ?? gardenId);
                setMessage(null);
              }}
              onOpenGrave={(id) => window.open(`/g/${id}`, "_blank", "noopener,noreferrer")}
            />
          ) : null}
          <p className="tiny muted">Open plots are marked with a faint oval. Choosing one does not reserve it until you submit.</p>
        </div>

        <form className="create-form panel" onSubmit={submit} noValidate>
          <div className="subsection-heading compact-heading">
            <div>
              <p className="step-number">02</p>
              <h2>Write the stone</h2>
            </div>
          </div>

          <div className="form-preview">
            <Gravestone grave={preview} />
          </div>

          <div className="form-fields">
            <div className="field">
              <div className="field-row">
                <label htmlFor="project-name">{t("form.title")}</label>
                <span>{countGraphemes(draft.title)}/48</span>
              </div>
              <input
                className="input"
                id="project-name"
                name="title"
                autoComplete="off"
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                aria-invalid={Boolean(fieldErrors.title?.length)}
                aria-describedby={fieldErrors.title?.length ? "title-error" : undefined}
              />
              {fieldErrors.title?.map((error) => <p className="field-error" id="title-error" key={error}>{error}</p>)}
            </div>

            <div className="field">
              <div className="field-row">
                <label htmlFor="epitaph">{t("form.epitaph")}</label>
                <span>{countGraphemes(draft.epitaph)}/160</span>
              </div>
              <textarea
                className="textarea"
                id="epitaph"
                name="epitaph"
                rows={3}
                value={draft.epitaph}
                onChange={(event) => updateDraft("epitaph", event.target.value)}
                aria-invalid={Boolean(fieldErrors.epitaph?.length)}
                aria-describedby={fieldErrors.epitaph?.length ? "epitaph-error" : undefined}
              />
              {fieldErrors.epitaph?.map((error) => <p className="field-error" id="epitaph-error" key={error}>{error}</p>)}
            </div>

            <div className="field field-year">
              <label htmlFor="started">{t("form.started")}</label>
              <input
                className="input"
                id="started"
                name="startedYear"
                inputMode="numeric"
                placeholder="e.g. 2022"
                value={draft.startedYear}
                onChange={(event) => updateDraft("startedYear", event.target.value)}
                aria-invalid={Boolean(fieldErrors.startedYear?.length)}
              />
              {fieldErrors.startedYear?.map((error) => <p className="field-error" key={error}>{error}</p>)}
            </div>
          </div>

          <div className="public-notice">
            <span aria-hidden="true">○</span>
            <p>{t("form.publicNotice")} Do not include contact details or links.</p>
          </div>
          {cemetery.needsAnonymousSession && runtime.turnstileSiteKey ? (
            <div className="field">
              <span className="field-label">Bot check</span>
              <TurnstileWidget key={captchaAttempt} siteKey={runtime.turnstileSiteKey} onToken={setCaptchaToken} />
            </div>
          ) : null}
          {message ? <p className="error-message" role="alert">{message}</p> : null}
          <button
            className="button button-primary submit-button"
            type="submit"
            disabled={submitting || Boolean(cemetery.needsAnonymousSession && runtime.turnstileSiteKey && !captchaToken)}
          >
            {submitting ? t("form.saving") : t("form.submit")}
          </button>
          <p className="tiny muted form-fine-print">Free · Public · Anonymous · Editable from this browser</p>
        </form>
      </section>
    </div>
  );
}
