import { DESIGNS } from "@/domain/designs";
import type { GraveAccent, GraveStyle, PublicGraveDto } from "@/domain/types";

import type { Locale } from "./config";

const japaneseExamples = [
  ["週末アプリ", "週末がいつなのか、最後まで決まりませんでした。"],
  ["はじめての小説", "地図は完成しました。物語は完成しませんでした。"],
  ["私たちのポッドキャスト", "収録日以外のすべてに合意しました。"],
  ["毎日更新のブログ", "3日間、見事に続きました。"],
  ["完璧なポートフォリオ", "いつも、あと1回のデザイン変更が必要でした。"],
  ["ゲームの試作品", "メニュー画面の雰囲気だけは最高でした。"],
  ["ニュースレター", "第0号には大きな可能性がありました。"],
  ["オンライン講座", "『はじめに』の『はじめに』まで修了しました。"],
  ["写真プロジェクト", "挑戦してよかった。"],
  ["短編映画", "絵コンテを見ると、今でも少し笑顔になります。"],
  ["レシピ本", "いくつか、おいしい夕食が生まれました。"],
  ["名前だけは最高のアプリ", "完成品は、その名前でした。"],
] as const;

const japaneseDesigns: Record<GraveStyle, { name: string; description: string }> = {
  classic: { name: "クラシック", description: "静かに風化した縁を持つ、簡素な石。" },
  moss: { name: "苔", description: "柔らかな庭の緑に、ゆっくりと包まれていく石。" },
  wildflowers: { name: "野の花", description: "何かを残してくれたアイデアへ、小さな花を。" },
  lantern: { name: "ランタン", description: "庭の小道に残された、低く温かな灯り。" },
};

const englishAccents: Record<GraveAccent, string> = {
  stone: "Stone",
  slate: "Slate",
  moon: "Moon",
  fern: "Fern",
  sage: "Sage",
  lichen: "Lichen",
  violet: "Violet",
  gold: "Gold",
  rose: "Rose",
  ember: "Ember",
  amber: "Amber",
  starlight: "Starlight",
};

const japaneseAccents: Record<GraveAccent, string> = {
  stone: "石",
  slate: "粘板岩",
  moon: "月光",
  fern: "シダ",
  sage: "セージ",
  lichen: "地衣類",
  violet: "スミレ",
  gold: "金色",
  rose: "バラ",
  ember: "残り火",
  amber: "琥珀",
  starlight: "星明かり",
};

export function localizeExampleGrave(grave: PublicGraveDto, locale: Locale): PublicGraveDto {
  if (locale === "en" || !grave.isExample) return grave;
  const match = grave.id.match(/^20000000-0000-4000-8000-(\d{12})$/);
  const index = match ? Number(match[1]) - 1 : -1;
  const localized = japaneseExamples[index];
  return localized ? { ...grave, title: localized[0], epitaph: localized[1] } : grave;
}

export function gardenName(ordinal: number, locale: Locale): string {
  return locale === "ja" ? `第${ordinal}庭園` : `Garden ${ordinal}`;
}

export function designCopy(style: GraveStyle, locale: Locale): { name: string; description: string } {
  if (locale === "ja") return japaneseDesigns[style];
  return { name: DESIGNS[style].name, description: DESIGNS[style].description };
}

export function accentName(accent: GraveAccent, locale: Locale): string {
  return locale === "ja" ? japaneseAccents[accent] : englishAccents[accent];
}
