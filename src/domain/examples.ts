import { DEMO_GARDEN_ID } from "./cemetery-layout";
import type { PublicGraveDto } from "./types";

const EXAMPLE_CONTENT = [
  ["My Weekend App", "The weekend was never specified."],
  ["My First Novel", "The map was finished. The story wasn’t."],
  ["Our Podcast", "We agreed on everything except a recording date."],
  ["My Daily Blog", "Three days of excellent consistency."],
  ["The Perfect Portfolio", "Always one redesign away."],
  ["My Game Prototype", "The menu had excellent atmosphere."],
  ["The Newsletter", "Issue zero was very promising."],
  ["The Online Course", "I completed the introduction to the introduction."],
  ["My Photo Project", "I’m glad I tried."],
  ["The Short Film", "The storyboard still makes me smile."],
  ["My Recipe Book", "A few good dinners came out of it."],
  ["The App With a Great Name", "The name was the finished product."],
] as const;

const EXAMPLE_PLOTS = [2, 7, 13, 18, 25, 31, 46, 53, 67, 74, 86, 94] as const;
const EXAMPLE_STYLES = ["classic", "moss", "wildflowers", "classic", "lantern", "classic", "moss", "wildflowers", "classic", "lantern", "moss", "classic"] as const;
const EXAMPLE_ACCENTS = ["stone", "fern", "violet", "slate", "ember", "moon", "sage", "gold", "stone", "amber", "lichen", "slate"] as const;

export const EXAMPLE_GRAVES: readonly PublicGraveDto[] = Object.freeze(
  EXAMPLE_CONTENT.map(([title, epitaph], index) =>
    Object.freeze({
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      gardenId: DEMO_GARDEN_ID,
      gardenOrdinal: 1,
      plotIndex: EXAMPLE_PLOTS[index],
      title,
      epitaph,
      buriedAt: new Date(Date.UTC(2026, 9, 1 + index)).toISOString(),
      style: EXAMPLE_STYLES[index],
      accent: EXAMPLE_ACCENTS[index],
      flowerCount: 0,
      isExample: true,
    }),
  ),
);

export function getExampleGrave(id: string): PublicGraveDto | undefined {
  return EXAMPLE_GRAVES.find((grave) => grave.id === id);
}
