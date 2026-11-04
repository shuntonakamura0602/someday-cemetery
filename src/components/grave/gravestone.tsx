"use client";

import { useI18n } from "@/components/language-provider";
import type { PublicGraveDto } from "@/domain";
import { localizeExampleGrave } from "@/i18n/presentation";

type GravestoneProps = {
  grave: PublicGraveDto;
  compact?: boolean;
  showText?: boolean;
  className?: string;
};

export function Gravestone({ grave, compact = false, showText = true, className = "" }: GravestoneProps) {
  const { locale, t } = useI18n();
  const localizedGrave = localizeExampleGrave(grave, locale);
  return (
    <div
      className={`gravestone gravestone-${localizedGrave.style} ${compact ? "gravestone-compact" : ""} ${className}`}
      data-accent={localizedGrave.accent}
      aria-hidden={compact ? true : undefined}
    >
      <div className="gravestone-glow" />
      <div className="gravestone-body">
        <div className="gravestone-age" />
        {localizedGrave.style === "moss" ? <span className="grave-moss" /> : null}
        {localizedGrave.style === "wildflowers" ? (
          <span className="grave-flowers">
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {localizedGrave.style === "lantern" ? <span className="grave-lantern" /> : null}
        {showText ? (
          <div className="gravestone-copy">
            <p className="gravestone-title">{localizedGrave.title}</p>
            {!compact && localizedGrave.epitaph ? <p className="gravestone-epitaph">{localizedGrave.epitaph}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="gravestone-base" />
      {localizedGrave.isExample && !compact ? <span className="stone-example">{t("example.badge")}</span> : null}
    </div>
  );
}
