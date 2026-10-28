"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ClientApiError, useCemetery } from "@/components/cemetery-provider";
import { Gravestone } from "@/components/grave/gravestone";
import { useRuntimeConfig } from "@/components/runtime-config";
import { DESIGNS, t, type GraveAccent, type GraveStyle, type OwnerGraveDto } from "@/domain";

const styles: GraveStyle[] = ["classic", "moss", "wildflowers", "lantern"];

export function CustomizeExperience({ graveId }: { graveId: string }) {
  const searchParams = useSearchParams();
  const runtime = useRuntimeConfig();
  const cemetery = useCemetery();
  const [grave, setGrave] = useState<OwnerGraveDto | null | undefined>(undefined);
  const [selectedStyle, setSelectedStyle] = useState<GraveStyle>("classic");
  const [selectedAccent, setSelectedAccent] = useState<GraveAccent>("stone");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("checkout") === "cancelled" ? t("payment.cancel") : null,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    cemetery.getOwnerGrave(graveId).then((value) => {
      if (!active) return;
      setGrave(value);
      if (value) {
        const pending = sessionStorage.getItem(`someday-cemetery:pending-style:${graveId}`) as GraveStyle | null;
        const nextStyle = pending && styles.includes(pending) ? pending : value.selectedStyle;
        setSelectedStyle(nextStyle);
        setSelectedAccent(DESIGNS[nextStyle].accents[0]);
      }
    }).catch(() => setGrave(null));
    return () => { active = false; };
  }, [cemetery, graveId]);

  if (grave === undefined) return <div className="narrow-page state-page">Preparing the headstones…</div>;
  if (!grave) {
    return (
      <section className="narrow-page state-page">
        <p className="eyebrow">Owner access required</p>
        <h1>Customize your own grave.</h1>
        <p className="lede">Restore editing access with the private link before opening checkout.</p>
        <div className="actions centered-actions">
          <Link className="button button-primary" href="/recover">Restore editing access</Link>
          <Link className="button button-secondary" href={`/g/${graveId}`}>Back to the grave</Link>
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
      setMessage("Unlock the three custom designs before applying this preview.");
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
      setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
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
        body: "{}",
      });
      const result = (await response.json()) as {
        kind?: "checkout" | "already_active";
        checkoutUrl?: string;
        code?: string;
        message?: string;
      };
      if (!response.ok) throw new ClientApiError(result.code ?? "CHECKOUT_FAILED", result.message ?? "Checkout is unavailable.", response.status);
      if (result.kind === "already_active") {
        const refreshed = await cemetery.getOwnerGrave(grave.id);
        if (refreshed) setGrave(refreshed);
        setMessage("This grave already has its custom headstones.");
        return;
      }
      if (!result.checkoutUrl) throw new Error("The hosted checkout URL was not returned.");
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : t("error.network"));
      setBusy(false);
    }
  }

  const preview = { ...grave, style: selectedStyle, accent: selectedAccent };
  const canPurchase = runtime.paymentsMode !== "off" && runtime.dataBackend === "supabase";

  return (
    <section className="wide-page customize-page">
      <header className="customize-header">
        <div>
          <p className="eyebrow">{t("upgrade.title")}</p>
          <h1>Choose how it rests.</h1>
          <p className="lede">The classic stone is always free. One purchase unlocks all three additional designs for this grave.</p>
        </div>
        <Link className="button button-secondary" href={`/g/${grave.id}`}>Back to the grave</Link>
      </header>

      <div className="customize-layout">
        <div className="customize-preview panel">
          <span className="pill">{grave.hasActiveEntitlement || selectedStyle === "classic" ? "Available" : "Preview"}</span>
          <Gravestone grave={preview} />
          <h2>{DESIGNS[selectedStyle].name}</h2>
          <p>{DESIGNS[selectedStyle].description}</p>
          <div className="accent-picker" aria-label="Choose a color">
            {DESIGNS[selectedStyle].accents.map((accent) => (
              <button
                key={accent}
                type="button"
                className={`accent-swatch accent-${accent}`}
                aria-label={`Use ${accent}`}
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
              return (
                <button
                  key={style}
                  className={`design-option ${selectedStyle === style ? "design-option-selected" : ""}`}
                  type="button"
                  onClick={() => chooseStyle(style)}
                  aria-pressed={selectedStyle === style}
                >
                  <span className={`design-mini design-mini-${style}`} aria-hidden="true" />
                  <span><strong>{design.name}</strong><small>{design.paid ? "Custom" : "Free"}</small></span>
                </button>
              );
            })}
          </div>

          <section className="purchase-card card">
            <div className="purchase-card-heading">
              <div>
                <p className="eyebrow">Custom Headstone</p>
                <h2>{t("upgrade.price")}</h2>
              </div>
              <span className="purchase-price">$7</span>
            </div>
            <ul>
              <li>Moss, Wildflowers, and Lantern for this grave</li>
              <li>Switch between all three whenever you like</li>
              <li>2400 × 1260 high-resolution keepsake</li>
              <li>No ranking or priority placement</li>
            </ul>
            <p className="tiny muted">{t("upgrade.tax")} Designs are available while the service operates; downloaded images stay with you.</p>
            {message ? <p className="notice-box" role="status">{message}</p> : null}
            {saved ? <p className="success-message">Headstone updated.</p> : null}
            {grave.hasActiveEntitlement ? (
              <div className="actions">
                <button className="button button-primary" type="button" onClick={applyDesign} disabled={busy}>{busy ? "Saving…" : "Apply this design"}</button>
                <a className="button button-secondary" href={`/api/graves/${grave.id}/keepsake`}>{t("upgrade.download")}</a>
              </div>
            ) : selectedStyle === "classic" ? (
              <button className="button button-primary" type="button" onClick={applyDesign} disabled={busy}>Use the free Classic stone</button>
            ) : (
              <button className="button button-primary" type="button" onClick={startCheckout} disabled={busy || !canPurchase}>
                {busy ? "Opening secure checkout…" : t("upgrade.buy")}
              </button>
            )}
            {!grave.hasActiveEntitlement && !canPurchase ? (
              <p className="tiny muted">
                {runtime.dataBackend === "demo"
                  ? "Custom designs are preview-only in the local demo. No purchase is simulated."
                  : "New purchases are currently off. Existing Custom Headstones remain available."}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
