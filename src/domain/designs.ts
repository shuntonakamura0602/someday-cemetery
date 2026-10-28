import type { GraveAccent, GraveStyle } from "./types";

export interface DesignDefinition {
  id: GraveStyle;
  name: string;
  description: string;
  paid: boolean;
  accents: readonly GraveAccent[];
  colors: { stone: string; detail: string; glow: string };
}

export const DESIGNS: Record<GraveStyle, DesignDefinition> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "A simple stone with a quiet, weathered edge.",
    paid: false,
    accents: ["stone", "slate", "moon"],
    colors: { stone: "#8f9990", detail: "#c7cec5", glow: "#d8e5cd" },
  },
  moss: {
    id: "moss",
    name: "Moss",
    description: "A patient stone reclaimed by soft garden green.",
    paid: true,
    accents: ["fern", "sage", "lichen"],
    colors: { stone: "#78867a", detail: "#789267", glow: "#c4d8ae" },
  },
  wildflowers: {
    id: "wildflowers",
    name: "Wildflowers",
    description: "Small blooms for the idea that still gave something back.",
    paid: true,
    accents: ["violet", "gold", "rose"],
    colors: { stone: "#92958d", detail: "#b79cc7", glow: "#ead39b" },
  },
  lantern: {
    id: "lantern",
    name: "Lantern",
    description: "A low, warm light left on at the garden path.",
    paid: true,
    accents: ["ember", "amber", "starlight"],
    colors: { stone: "#697674", detail: "#d3a45f", glow: "#f3cf8e" },
  },
};

export const GRAVE_STYLES = Object.freeze(Object.keys(DESIGNS) as GraveStyle[]);

export function isGraveStyle(value: unknown): value is GraveStyle {
  return typeof value === "string" && value in DESIGNS;
}

export function isAccentAllowed(style: GraveStyle, accent: unknown): accent is GraveAccent {
  return typeof accent === "string" && DESIGNS[style].accents.includes(accent as GraveAccent);
}

export function getDefaultAccent(style: GraveStyle): GraveAccent {
  return DESIGNS[style].accents[0];
}

export function getEffectiveStyle(
  selectedStyle: GraveStyle,
  hasActiveEntitlement: boolean,
  isExample = false,
): GraveStyle {
  if (selectedStyle === "classic" || hasActiveEntitlement || isExample) return selectedStyle;
  return "classic";
}

export function getEffectiveAccent(style: GraveStyle, selectedAccent: GraveAccent): GraveAccent {
  return isAccentAllowed(style, selectedAccent) ? selectedAccent : getDefaultAccent(style);
}
