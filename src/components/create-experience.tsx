"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZodError } from "zod";

import { CemeteryMap } from "@/components/cemetery/cemetery-map";
import { useCemetery, ClientApiError } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useI18n } from "@/components/language-provider";
import { useRuntimeConfig } from "@/components/runtime-config";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  countGraphemes,
  parseCreateGraveInput,
  type CreatedGraveResult,
  type PublicGraveDto,
} from "@/domain";
import { clearDraft, loadDraft, saveDraft, type DemoDraft } from "@/demo";

const blankDraft: DemoDraft = { title: "", epitaph: "", startedYear: "" };

export function CreateExperience() {
  const searchParams = useSearchParams();
  const cemetery = useCemetery();
  const runtime = useRuntimeConfig();
  const { locale, t, localizeError } = useI18n();
  const isJapanese = locale === "ja";
  const [draft, setDraft] = useState<DemoDraft>(blankDraft);
  const [draftReady, setDraftReady] = useState(false);
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
  const previousLocale = useRef(locale);

  function localizedFieldMessage(field: string, message: string, code?: string) {
    const localized = localizeError(message, code);
    if (!isJapanese || localized !== message) return localized;
    if (field === "startedYear") return "開始年は1900年から現在までの西暦で入力してください。";
    return "入力内容を確認してください。";
  }

  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setFieldErrors({});
    setMessage(null);
  }, [locale]);

  useEffect(() => {
    if (hydrated.current) return;
    const timer = window.setTimeout(() => {
      if (hydrated.current) return;
      const stored = loadDraft();
      const requestedPlotParam = searchParams.get("plot");
      const requestedPlot = requestedPlotParam === null ? Number.NaN : Number(requestedPlotParam);
      setDraft(stored);
      if (Number.isInteger(requestedPlot) && requestedPlot >= 0 && requestedPlot < 100) {
        setSelectedPlot(requestedPlot);
      } else if (stored.plotIndex !== undefined) setSelectedPlot(stored.plotIndex);
      setGardenId(searchParams.get("garden") || stored.gardenId || null);
      hydrated.current = true;
      setDraftReady(true);
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
      title: draft.title.trim() || (isJapanese ? "あなたの未完成のもの" : "Your unfinished thing"),
      epitaph: draft.epitaph.trim() || undefined,
      startedYear: /^\d{4}$/.test(draft.startedYear) ? Number(draft.startedYear) : undefined,
      buriedAt: new Date().toISOString(),
      style: "classic",
      accent: "stone",
      flowerCount: 0,
      isExample: false,
    }),
    [cemetery.currentGarden?.ordinal, draft, effectiveGardenId, isJapanese, selectedPlot],
  );

  function updateDraft<K extends keyof DemoDraft>(key: K, value: DemoDraft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (hydrated.current && !created) {
      saveDraft({ ...next, gardenId: effectiveGardenId ?? undefined, plotIndex: selectedPlot ?? undefined });
    }
    setFieldErrors((current) => ({ ...current, [key]: [] }));
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});
    if (!effectiveGardenId || selectedPlot === null) {
      setMessage(isJapanese ? "続ける前に、眠る場所を選んでください。" : "Choose a resting place before continuing.");
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
          next[field] = [...(next[field] ?? []), localizedFieldMessage(field, issue.message)];
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
      if (requestError instanceof ClientApiError && requestError.fieldErrors) {
        setFieldErrors(Object.fromEntries(
          Object.entries(requestError.fieldErrors).map(([field, errors]) => [
            field,
            errors.map((error) => localizedFieldMessage(field, error, requestError.code)),
          ]),
        ));
      }
      if (code === "AUTH_UNAVAILABLE") {
        setCaptchaToken(null);
        setCaptchaAttempt((attempt) => attempt + 1);
      }
      if (code === "PLOT_TAKEN") {
        setSelectedPlot(null);
        setMessage(t("error.plotTaken"));
      } else {
        const localized = requestError instanceof Error ? localizeError(requestError.message, code || undefined) : t("error.network");
        setMessage(isJapanese && requestError instanceof Error && localized === requestError.message ? t("error.network") : localized);
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
      [isJapanese
        ? `Someday Cemetery 非公開の復旧リンク\n\n${created.recoveryUrl}\n\nこのリンクを知っている人は墓碑の編集権限を引き継げます。公開しないでください。\n`
        : `Someday Cemetery private recovery link\n\n${created.recoveryUrl}\n\nAnyone with this link can take over editing this grave. Keep it private.\n`],
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
          <p className="eyebrow">{isJapanese ? "静かに眠りました" : "Laid to rest"}</p>
          <h1>{t("grave.created")}</h1>
          <p className="lede">
            {isJapanese
              ? "公開ページができました。下の非公開リンクは、別の端末へ編集権限を移すための唯一の鍵です。"
              : "Its public place is ready. The private link below is the only portable key to editing it."}
          </p>
          <div className="created-links">
            <section className="card created-link-card">
              <p className="field-label">{isJapanese ? "公開リンク" : "Public link"}</p>
              <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/g/${created.grave.id}`}</code>
              <button className="button button-secondary" type="button" onClick={copyPublicLink}>
                {copied ? t("share.copied") : t("share.public")}
              </button>
            </section>
            {created.recoveryUrl ? (
              <section className="card created-link-card recovery-card">
                <p className="field-label">{isJapanese ? "非公開の復旧リンク" : "Private recovery link"}</p>
                <p>{t("recovery.warning")}</p>
                <code className="secret-code">{created.recoveryUrl}</code>
                <button className="button button-primary" type="button" onClick={saveRecoveryLink}>
                  {t("recovery.save")}
                </button>
                <p className="tiny muted">{t("recovery.explanation")}</p>
              </section>
            ) : (
              <section className="notice-box">
                <p>
                  {isJapanese
                    ? "以前の送信を安全に再試行しました。編集ページを開き、新しい非公開の復旧リンクを発行してください。"
                    : "This was a safe retry of an earlier request. Open the edit page to issue a fresh private recovery link."}
                </p>
              </section>
            )}
          </div>
          <div className="actions">
            <Link className="button button-primary" href={`/g/${created.grave.id}`}>
              {isJapanese ? "墓碑を見る" : "Visit the grave"}
            </Link>
            <Link className="button button-secondary" href={`/g/${created.grave.id}/customize`}>
              {isJapanese ? "カスタム墓石を試す" : "Preview custom headstones"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!draftReady) {
    return (
      <div className="narrow-page state-page">
        {isJapanese ? "静かな区画を用意しています…" : "Preparing a quiet plot…"}
      </div>
    );
  }

  return (
    <div className="create-page wide-page">
      <header className="create-header">
        <p className="eyebrow">{isJapanese ? "小さな区切り" : "A small ending"}</p>
        <h1>{isJapanese ? "未完成のものを、静かに眠らせる。" : "Lay something to rest."}</h1>
        <p className="lede">
          {isJapanese
            ? "静かな区画を選び、未完成のものに名前をつけてください。別れの言葉は任意です。"
            : "Choose a quiet plot. Give the unfinished thing its name. Parting words are optional."}
        </p>
      </header>

      <section className="create-grid">
        <div className="plot-picker" id="plot-picker">
          <div className="subsection-heading">
            <div>
              <p className="step-number">01</p>
              <h2>{t("plot.choose")}</h2>
            </div>
            <span className="pill">
              {selectedPlot === null
                ? (isJapanese ? "区画が未選択です" : "No plot chosen")
                : (isJapanese ? `区画 ${selectedPlot + 1}` : `Plot ${selectedPlot + 1}`)}
            </span>
          </div>
          {cemetery.loading ? (
            <div className="map-loading">{isJapanese ? "空いている区画を表示しています…" : "The open plots are coming into view…"}</div>
          ) : null}
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
          <p className="tiny muted">
            {isJapanese
              ? "空いている区画には淡い楕円が表示されます。送信するまでは予約されません。"
              : "Open plots are marked with a faint oval. Choosing one does not reserve it until you submit."}
          </p>
        </div>

        <form className="create-form panel" onSubmit={submit} noValidate>
          <div className="subsection-heading compact-heading">
            <div>
              <p className="step-number">02</p>
              <h2>{isJapanese ? "墓碑を書く" : "Write the stone"}</h2>
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
                placeholder={isJapanese ? "例：2022" : "e.g. 2022"}
                value={draft.startedYear}
                onChange={(event) => updateDraft("startedYear", event.target.value)}
                aria-invalid={Boolean(fieldErrors.startedYear?.length)}
              />
              {fieldErrors.startedYear?.map((error) => <p className="field-error" key={error}>{error}</p>)}
            </div>
          </div>

          <div className="public-notice">
            <span aria-hidden="true">○</span>
            <p>
              {t("form.publicNotice")} {isJapanese ? "連絡先やリンクは含めないでください。" : "Do not include contact details or links."}
            </p>
          </div>
          {cemetery.needsAnonymousSession && runtime.turnstileSiteKey ? (
            <div className="field">
              <span className="field-label">{isJapanese ? "ボット確認" : "Bot check"}</span>
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
          <p className="tiny muted form-fine-print">
            {isJapanese ? "無料・公開・匿名・このブラウザから編集可能" : "Free · Public · Anonymous · Editable from this browser"}
          </p>
        </form>
      </section>
    </div>
  );
}
