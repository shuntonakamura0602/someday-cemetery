"use client";

import Link from "next/link";

import { useI18n } from "@/components/language-provider";
import type { PublicGraveDto } from "@/domain";
import { gardenName, localizeExampleGrave } from "@/i18n/presentation";

export function GraveList({ graves, empty }: { graves: PublicGraveDto[]; empty?: string }) {
  const { locale, t, formatNumber } = useI18n();
  const emptyMessage = empty ?? (locale === "ja" ? "ここには、まだ墓碑がありません。" : "No graves are resting here yet.");
  if (!graves.length) return <div className="empty-state">{emptyMessage}</div>;
  return (
    <div className="grave-list">
      {graves.map((sourceGrave) => {
        const grave = localizeExampleGrave(sourceGrave, locale);
        return (
          <Link className="grave-list-item" href={`/g/${grave.id}`} key={grave.id}>
            <div>
              <div className="grave-list-meta">
                <span>
                  {gardenName(grave.gardenOrdinal ?? 1, locale)} · {locale === "ja" ? "区画" : "Plot"}{" "}
                  {formatNumber(grave.plotIndex + 1)}
                </span>
                {grave.isExample ? <span className="badge badge-example">{t("example.badge")}</span> : null}
              </div>
              <h3>{grave.title}</h3>
              {grave.epitaph ? <p>{grave.epitaph}</p> : null}
            </div>
            <span className="grave-list-arrow" aria-hidden="true">↗</span>
          </Link>
        );
      })}
    </div>
  );
}
