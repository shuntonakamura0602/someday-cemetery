export const GARDEN_CAPACITY = 100 as const;
export const GARDEN_LAYOUT_VERSION = "garden-v1" as const;

export interface PlotPosition {
  index: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** Versioned deterministic coordinates: never reorder an existing layout version. */
export const GARDEN_V1_PLOTS: readonly PlotPosition[] = Object.freeze(
  Array.from({ length: GARDEN_CAPACITY }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const stagger = row % 2 === 0 ? 0 : 1.8;
    return Object.freeze({
      index,
      x: Number((7.5 + column * 9.1 + stagger).toFixed(2)),
      y: Number((12 + row * 8.35).toFixed(2)),
      rotation: ((index * 7) % 9) - 4,
      scale: Number((0.92 + ((index * 13) % 9) / 100).toFixed(2)),
    });
  }),
);

export function getPlotPosition(plotIndex: number): PlotPosition {
  if (!Number.isInteger(plotIndex) || plotIndex < 0 || plotIndex >= GARDEN_CAPACITY) {
    throw new RangeError("plotIndex must be an integer from 0 through 99");
  }
  return GARDEN_V1_PLOTS[plotIndex];
}

export function gardenIdForOrdinal(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 999_999) {
    throw new RangeError("Garden ordinal must be a positive integer");
  }
  return `10000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
}

export const DEMO_GARDEN_ID = gardenIdForOrdinal(1);
