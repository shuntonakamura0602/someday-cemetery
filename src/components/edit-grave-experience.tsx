"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";

import { useCemetery, ClientApiError } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import {
  DESIGNS,
  countGraphemes,
  parseUpdateGraveInput,
  t,
  type GraveAccent,
  type GraveStyle,
  type OwnerGraveDto,
} from "@/domain";

export function EditGraveExperience({ graveId }: { graveId: string }) {
  const router = useRouter();
  const cemetery = useCemetery();
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

  function applyGrave(next: OwnerGraveDto) {
    setGrave(next);
    setTitle(next.title);
    setEpitaph(next.epitaph ?? "");
    setStartedYear(next.startedYear ? String(next.startedYear) : "");
    setStyle(next.selectedStyle);
    setAccent(next.selectedAccent);
  }

  useEffect(() => {
    let active = true;
    cemetery.getOwnerGrave(graveId).then((value) => {
      if (!active) return;
      if (value) applyGrave(value);
      else setGrave(null);
    }).catch(() => setGrave(null));
    return () => { active = false; };
  }, [cemetery, graveId]);

  if (grave === undefined) return <div className="narrow-page state-page">Finding your grave…</div>;
  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">Editing access required</p>
        <h1>This grave is not in your current session.</h1>
        <p className="lede">Use its private recovery link to restore editing access on this browser.</p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href="/recover">Restore editing access</Link>
          <Link className="button button-secondary" href={`/g/${graveId}`}>View public grave</Link>
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
          next[field] = [...(next[field] ?? []), issue.message];
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
      if (requestError instanceof ClientApiError && requestError.fieldErrors) setErrors(requestError.fieldErrors);
      setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
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
      setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
    } finally {
      setRecoveryBusy(false);
    }
  }

  function saveRecoveryFile() {
    if (!recoveryUrl || !grave) return;
    const graveId = grave.id;
    const blob = new Blob([`${recoveryUrl}\n`], { type: "text/plain;charset=utf-8" });
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
      setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
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
          <p className="eyebrow">Owner controls</p>
          <h1>Edit this grave.</h1>
        </div>
        <Link className="button button-secondary" href={`/g/${grave.id}`}>Back to the grave</Link>
      </header>
      {grave.status === "hidden" ? (
        <div className="notice-box moderation-notice">
          <strong>This grave is hidden from the public garden.</strong> Editing it will not publish it again. Contact support if you need a review.
        </div>
      ) : null}

      <div className="edit-grid">
        <div className="edit-preview panel">
          <Gravestone grave={preview} />
          <p className="tiny muted">Garden {grave.gardenOrdinal ?? 1} · Plot {grave.plotIndex + 1}</p>
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
              <label htmlFor="edit-style">Headstone</label>
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
                {allowedStyles.map((id) => <option key={id} value={id}>{DESIGNS[id].name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit-accent">Color</label>
              <select className="select" id="edit-accent" value={accent} onChange={(event) => setAccent(event.target.value as GraveAccent)}>
                {DESIGNS[style].accents.map((id) => <option key={id} value={id}>{id[0].toUpperCase() + id.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {!grave.hasActiveEntitlement ? <Link className="text-link tiny" href={`/g/${grave.id}/customize`}>Preview three additional headstones →</Link> : null}
          {message ? <p className="error-message" role="alert">{message}</p> : null}
          {saved ? <p className="success-message" role="status">Changes saved.</p> : null}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </form>
      </div>

      <div className="owner-tools">
        <section className="card owner-tool-card">
          <div>
            <p className="eyebrow">Private recovery</p>
            <h2>Make a new key.</h2>
            <p>{t("recovery.explanation")} Creating a new link replaces every older recovery link.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={rotateRecovery} disabled={recoveryBusy}>
            {recoveryBusy ? "Creating…" : "Create a new recovery link"}
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
            <p className="eyebrow">Permanent</p>
            <h2>Delete this grave.</h2>
            <p>The text and images will be removed from this site. Its plot can be used again. This cannot be undone.</p>
          </div>
          <button className="button button-danger" type="button" onClick={() => deleteDialog.current?.showModal()}>{t("delete.action")}</button>
        </section>
      </div>

      <dialog className="report-dialog" ref={deleteDialog}>
        <form method="dialog" className="dialog-close-row"><button className="icon-button" value="cancel" aria-label="Cancel deletion">×</button></form>
        <h2>Delete this grave?</h2>
        <p>{t("delete.confirm")}</p>
        <div className="actions">
          <button className="button button-danger" type="button" onClick={deleteGrave} disabled={busy}>Delete permanently</button>
          <form method="dialog"><button className="button button-secondary" value="cancel">Keep the grave</button></form>
        </div>
      </dialog>
    </section>
  );
}
