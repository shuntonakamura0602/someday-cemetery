import type { MemorialImageModel, PublicGraveDto } from "./types";
import { splitGraphemes } from "./validation";

export function buildMemorialImageModel(grave: PublicGraveDto): MemorialImageModel {
  return {
    serviceName: "Someday Cemetery",
    title: grave.title,
    epitaph: grave.epitaph,
    startedYear: grave.startedYear,
    buriedDate: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(grave.buriedAt)),
    style: grave.style,
    accent: grave.accent,
    isExample: grave.isExample,
  };
}

/** Wrap without truncating, including a grapheme fallback for long words. */
export function wrapText(text: string, maxWidth: number, measure: (candidate: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let current = "";
    for (const word of paragraph.split(/\s+/u)) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) { current = candidate; continue; }
      if (current) { lines.push(current); current = ""; }
      if (measure(word) <= maxWidth) { current = word; continue; }
      let fragment = "";
      for (const grapheme of splitGraphemes(word)) {
        if (fragment && measure(fragment + grapheme) > maxWidth) { lines.push(fragment); fragment = grapheme; }
        else fragment += grapheme;
      }
      current = fragment;
    }
    if (current) lines.push(current);
  }
  return lines;
}
