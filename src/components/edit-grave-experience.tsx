"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";

import { useCemetery, ClientApiError } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useI18n } from "@/components/language-provider";
import {
  DESIGNS,
  countGraphemes,
  parseUpdateGraveInput,
  type GraveAccent,
  type GraveStyle,
  type OwnerGraveDto,
} from "@/domain";
import { accentName, designCopy, gardenName } from "@/i18n/presentation";

export function EditGraveExperience({ graveId }: { graveId: string }) {
  const router = useRouter();
  const cemetery = useCemetery();
  const { locale, t, localizeError } = useI18n();
  const isJapanese = locale === "ja";
  const [grave, setGrave] = useState<OwnerGraveDto | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [epitaph, setEpitaph] = useState("");
  const [startedYear, setStartedYear] = useState("");
  const [style, setStyle] = useState<GraveStyle>("classic");
  const [accent, setAccent] = useState<GraveAccent>("stone");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const loadedGraveId = useRef<string | null>(null);
  const previousLocale = useRef(locale);

  function localizedRequestError(error: unknown) {
    if (!(error instanceof Error)) return t("error.network");
    const code = error instanceof ClientApiError
      ? error.code
      : "code" in error
        ? String(error.code)
        : undefined;
    const localized = localizeError(error.message, code);
    return isJapanese && localized === error.message ? t("error.network") : localized;
  }

  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setErrors({});
    setMessage(null);
  }, [locale]);

  function localizedFieldMessage(field: string, message: string, code?: string) {
    const localized = localizeError(message, code);
    if (!isJapanese || localized !== message) return localized;
    if (field === "startedYear") return "開始年は1900年から現在までの西暦で入力してください。";
    if (field === "accent") return "この墓石で利用できる色を選んでください。";
    return "入力内容を確認してください。";
  }

  function applyGrave(next: OwnerGraveDto) {
    setGrave(next);
    setTitle(next.title);
    setEpitaph(next.epitaph ?? "");
    setStartedYear(next.startedYear ? String(next.startedYear) : "");
    setStyle(next.selectedStyle);
    setAccent(next.selectedAccent);
  }

  useEffect(() => {
    if (loadedGraveId.current === graveId) return;
    let active = true;
    cemetery.getOwnerGrave(graveId).then((value) => {
      if (!active) return;
      loadedGraveId.current = graveId;
      if (value) applyGrave(value);
      else setGrave(null);
    }).catch(() => {
      if (!active) return;
      setGrave(null);
    });
    return () => { active = false; };
  }, [cemetery, graveId]);

  if (grave === undefined) {
    return <div className="narrow-page state-page">{isJapanese ? "墓碑を探しています…" : "Finding your grave…"}</div>;
  }
  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">{isJapanese ? "編集権限が必要です" : "Editing access required"}</p>
        <h1>{isJapanese ? "この墓碑は現在のセッションにありません。" : "This grave is not in your current session."}</h1>
        <p className="lede">
          {isJapanese
            ? "非公開の復旧リンクを使い、このブラウザに編集権限を復旧してください。"
            : "Use its private recovery link to restore editing access on this browser."}
        </p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href="/recover">{t("recovery.action")}</Link>
          <Link className="button button-secondary" href={`/g/${graveId}`}>
            {isJapanese ? "公開墓碑を見る" : "View public grave"}
          </Link>
        </div>
      </section>
    );
  }

  const preview = { ...grave, title: title || grave.title, epitaph: epitaph || undefined, style, accent };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!grave) return;
    setMessage(null);
    setErrors({});
    setSaved(false);
    let input;
    try {
      input = parseUpdateGraveInput({
        title,
        epitaph,
        startedYear,
        selectedStyle: style,
        accent,
        version: grave.version,
      });
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const next: Record<string, string[]> = {};
        validationError.issues.forEach((issue) => {
          const field = String(issue.path[0] ?? "form");
          next[field] = [...(next[field] ?? []), localizedFieldMessage(field, issue.message)];
        });
        setErrors(next);
      }
      return;
    }
    setBusy(true);
    try {
      const updated = await cemetery.updateGrave(grave.id, input);
      applyGrave(updated);
      setSaved(true);
    } catch (requestError) {
      if (requestError instanceof ClientApiError && requestError.fieldErrors) {
        setErrors(Object.fromEntries(
          Object.entries(requestError.fieldErrors).map(([field, fieldErrors]) => [
            field,
            fieldErrors.map((error) => localizedFieldMessage(field, error, requestError.code)),
          ]),
        ));
      }
      setMessage(localizedRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function rotateRecovery() {
    if (!grave) return;
    const graveId = grave.id;
    setRecoveryBusy(true);
    setMessage(null);
    try {
      const nextUrl = await cemetery.rotateRecoveryLink(graveId);
      setRecoveryUrl(nextUrl);
      const latest = await cemetery.getOwnerGrave(graveId);
      if (latest) applyGrave(latest);
    } catch (requestError) {
      setMessage(localizedRequestError(requestError));
    } finally {
      setRecoveryBusy(false);
    }
  }

  function saveRecoveryFile() {
    if (!recoveryUrl || !grave) return;
    const graveId = grave.id;
    const blob = new Blob(
      [isJapanese
        ? `Someday Cemetery 非公開の復旧リンク\n\n${recoveryUrl}\n\nこのリンクを知っている人は墓碑の編集権限を引き継げます。公開しないでください。\n`
        : `Someday Cemetery private recovery link\n\n${recoveryUrl}\n\nAnyone with this link can take over editing this grave. Keep it private.\n`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `someday-cemetery-recovery-${graveId}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function deleteGrave() {
    if (!grave) return;
    const graveId = grave.id;
    const version = grave.version;
    setBusy(true);
    try {
      await cemetery.deleteGrave(graveId, version);
      router.replace("/my-graves");
    } catch (requestError) {
      setMessage(localizedRequestError(requestError));
      deleteDialog.current?.close();
      setBusy(false);
    }
  }

  const allowedStyles: GraveStyle[] = grave.hasActiveEntitlement
    ? ["classic", "moss", "wildflowers", "lantern"]
    : ["classic"];

  return (
    <section className="wide-page edit-page">
      <header className="edit-header">
        <div>
          <p className="eyebrow">{isJapanese ? "所有者メニュー" : "Owner controls"}</p>
          <h1>{isJapanese ? "この墓碑を編集する。" : "Edit this grave."}</h1>
        </div>
        <Link className="button button-secondary" href={`/g/${grave.id}`}>
          {isJapanese ? "墓碑に戻る" : "Back to the grave"}
        </Link>
      </header>
      {grave.status === "hidden" ? (
        <div className="notice-box moderation-notice">
          <strong>{isJapanese ? "この墓碑は公開の庭から非表示になっています。" : "This grave is hidden from the public garden."}</strong>{" "}
          {isJapanese
            ? "編集しても再公開されません。確認が必要な場合は運営者へお問い合わせください。"
            : "Editing it will not publish it again. Contact support if you need a review."}
        </div>
      ) : null}

      <div className="edit-grid">
        <div className="edit-preview panel">
          <Gravestone grave={preview} />
          <p className="tiny muted">
            {gardenName(grave.gardenOrdinal ?? 1, locale)} · {isJapanese ? `区画 ${grave.plotIndex + 1}` : `Plot ${grave.plotIndex + 1}`}
          </p>
        </div>
        <form className="edit-form" onSubmit={save} noValidate>
          <div className="field">
            <div className="field-row"><label htmlFor="edit-title">{t("form.title")}</label><span>{countGraphemes(title)}/48</span></div>
            <input className="input" id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            {errors.title?.map((error) => <p className="field-error" key={error}>{error}</p>)}
          </div>
          <div className="field">
            <div className="field-row"><label htmlFor="edit-epitaph">{t("form.epitaph")}</label><span>{countGraphemes(epitaph)}/160</span></div>
            <textarea className="textarea" id="edit-epitaph" rows={3} value={epitaph} onChange={(event) => setEpitaph(event.target.value)} />
            {errors.epitaph?.map((error) => <p className="field-error" key={error}>{error}</p>)}
          </div>
          <div className="field field-year">
            <label htmlFor="edit-started">{t("form.started")}</label>
            <input className="input" id="edit-started" inputMode="numeric" value={startedYear} onChange={(event) => setStartedYear(event.target.value)} />
            {errors.startedYear?.map((error) => <p className="field-error" key={error}>{error}</p>)}
          </div>
          <div className="edit-design-fields">
            <div className="field">
              <label htmlFor="edit-style">{isJapanese ? "墓石" : "Headstone"}</label>
              <select
                className="select"
                id="edit-style"
                value={style}
                onChange={(event) => {
                  const nextStyle = event.target.value as GraveStyle;
                  setStyle(nextStyle);
                  setAccent(DESIGNS[nextStyle].accents[0]);
                }}
              >
                {allowedStyles.map((id) => <option key={id} value={id}>{designCopy(id, locale).name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit-accent">{isJapanese ? "色" : "Color"}</label>
              <select className="select" id="edit-accent" value={accent} onChange={(event) => setAccent(event.target.value as GraveAccent)}>
                {DESIGNS[style].accents.map((id) => <option key={id} value={id}>{accentName(id, locale)}</option>)}
              </select>
            </div>
          </div>
          {!grave.hasActiveEntitlement ? (
            <Link className="text-link tiny" href={`/g/${grave.id}/customize`}>
              {isJapanese ? "追加の3種類の墓石を試す →" : "Preview three additional headstones →"}
            </Link>
          ) : null}
          {message ? <p className="error-message" role="alert">{message}</p> : null}
          {saved ? <p className="success-message" role="status">{isJapanese ? "変更を保存しました。" : "Changes saved."}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? (isJapanese ? "保存しています…" : "Saving…") : (isJapanese ? "変更を保存" : "Save changes")}
          </button>
        </form>
      </div>

      <div className="owner-tools">
        <section className="card owner-tool-card">
          <div>
            <p className="eyebrow">{isJapanese ? "非公開の復旧" : "Private recovery"}</p>
            <h2>{isJapanese ? "新しい鍵をつくる。" : "Make a new key."}</h2>
            <p>
              {t("recovery.explanation")} {isJapanese
                ? "新しいリンクを作成すると、以前の復旧リンクはすべて無効になります。"
                : "Creating a new link replaces every older recovery link."}
            </p>
          </div>
          <button className="button button-secondary" type="button" onClick={rotateRecovery} disabled={recoveryBusy}>
            {recoveryBusy
              ? (isJapanese ? "作成しています…" : "Creating…")
              : (isJapanese ? "新しい復旧リンクを作成" : "Create a new recovery link")}
          </button>
          {recoveryUrl ? (
            <div className="recovery-result notice-box">
              <strong>{t("recovery.warning")}</strong>
              <code>{recoveryUrl}</code>
              <button className="button button-primary" type="button" onClick={saveRecoveryFile}>{t("recovery.save")}</button>
            </div>
          ) : null}
        </section>

        <section className="card owner-tool-card danger-zone">
          <div>
            <p className="eyebrow">{isJapanese ? "取り消せない操作" : "Permanent"}</p>
            <h2>{isJapanese ? "この墓碑を削除する。" : "Delete this grave."}</h2>
            <p>
              {isJapanese
                ? "文章と画像はこのサイトから削除され、区画は再び使用できるようになります。この操作は元に戻せません。"
                : "The text and images will be removed from this site. Its plot can be used again. This cannot be undone."}
            </p>
          </div>
          <button className="button button-danger" type="button" onClick={() => deleteDialog.current?.showModal()}>{t("delete.action")}</button>
        </section>
      </div>

      <dialog className="report-dialog" ref={deleteDialog}>
        <form method="dialog" className="dialog-close-row">
          <button className="icon-button" value="cancel" aria-label={isJapanese ? "削除をキャンセル" : "Cancel deletion"}>×</button>
        </form>
        <h2>{isJapanese ? "この墓碑を削除しますか？" : "Delete this grave?"}</h2>
        <p>{t("delete.confirm")}</p>
        <div className="actions">
          <button className="button button-danger" type="button" onClick={deleteGrave} disabled={busy}>
            {isJapanese ? "完全に削除" : "Delete permanently"}
          </button>
          <form method="dialog">
            <button className="button button-secondary" value="cancel">{isJapanese ? "墓碑を残す" : "Keep the grave"}</button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
