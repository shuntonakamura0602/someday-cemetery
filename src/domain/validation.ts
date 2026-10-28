import { z } from "zod";
import { DESIGNS, isAccentAllowed } from "./designs";
import type { CreateGraveInput, GraveAccent, GraveStyle, UpdateGraveInput } from "./types";

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : undefined;

export function countGraphemes(value: string): number {
  return segmenter ? Array.from(segmenter.segment(value)).length : Array.from(value).length;
}

export function splitGraphemes(value: string): string[] {
  return segmenter ? Array.from(segmenter.segment(value), ({ segment }) => segment) : Array.from(value);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n").normalize("NFC");
}

export function normalizeTitle(value: string): string {
  return normalizeLineEndings(value).replace(/\n+/g, " ").replace(/[\t ]+/g, " ").trim();
}

export function normalizeEpitaph(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeLineEndings(value).split("\n").map((line) => line.trim()).join("\n").trim();
  return normalized.length > 0 ? normalized : undefined;
}

export type ContactKind = "url" | "email" | "phone";
const URL_PATTERN = /(?:https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|org|net|io|dev|app|co|me|xyz)\b)/iu;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u;
const PHONE_CANDIDATE_PATTERN = /(?:^|\D)(\+?\d[\d\s().-]{5,}\d)(?:\D|$)/u;

export function findDisallowedContact(value: string): ContactKind | null {
  if (EMAIL_PATTERN.test(value)) return "email";
  if (URL_PATTERN.test(value)) return "url";
  const phone = value.match(PHONE_CANDIDATE_PATTERN)?.[1];
  if (phone && phone.replace(/\D/g, "").length >= 7) return "phone";
  return null;
}

const titleSchema = z.string().min(1, "Enter a project name.")
  .refine((value) => countGraphemes(value) <= 48, "Use 48 characters or fewer.")
  .refine((value) => !findDisallowedContact(value), "Do not include contact details or links.");
const epitaphSchema = z.string()
  .refine((value) => countGraphemes(value) <= 160, "Use 160 characters or fewer.")
  .refine((value) => value.split("\n").length <= 3, "Use no more than 3 lines.")
  .refine((value) => !findDisallowedContact(value), "Do not include contact details or links.").optional();

export const normalizedCreateGraveSchema = z.object({
  gardenId: z.uuid(),
  plotIndex: z.number().int().min(0).max(99),
  title: titleSchema,
  epitaph: epitaphSchema,
  startedYear: z.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
});

export const normalizedUpdateGraveSchema = normalizedCreateGraveSchema.omit({ gardenId: true, plotIndex: true }).extend({
  selectedStyle: z.enum(["classic", "moss", "wildflowers", "lantern"]),
  accent: z.string(),
  version: z.number().int().positive(),
}).superRefine((value, context) => {
  if (!isAccentAllowed(value.selectedStyle, value.accent)) {
    context.addIssue({ code: "custom", path: ["accent"], message: "Choose a color offered for this design." });
  }
});

function optionalYear(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return value as number;
}

export function parseCreateGraveInput(input: unknown): CreateGraveInput {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return normalizedCreateGraveSchema.parse({
    gardenId: raw.gardenId,
    plotIndex: typeof raw.plotIndex === "string" ? Number(raw.plotIndex) : raw.plotIndex,
    title: normalizeTitle(typeof raw.title === "string" ? raw.title : ""),
    epitaph: normalizeEpitaph(typeof raw.epitaph === "string" ? raw.epitaph : undefined),
    startedYear: optionalYear(raw.startedYear),
  });
}

export function parseUpdateGraveInput(input: unknown): UpdateGraveInput {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const parsed = normalizedUpdateGraveSchema.parse({
    title: normalizeTitle(typeof raw.title === "string" ? raw.title : ""),
    epitaph: normalizeEpitaph(typeof raw.epitaph === "string" ? raw.epitaph : undefined),
    startedYear: optionalYear(raw.startedYear),
    selectedStyle: raw.selectedStyle,
    accent: raw.accent,
    version: typeof raw.version === "string" ? Number(raw.version) : raw.version,
  });
  return parsed as UpdateGraveInput;
}

export function isPlainText(value: string): boolean {
  return !/<\/?[a-z][^>]*>/iu.test(value);
}

export function isPaidStyle(style: GraveStyle): boolean { return DESIGNS[style].paid; }

export function assertAccent(style: GraveStyle, accent: string): GraveAccent {
  if (!isAccentAllowed(style, accent)) throw new Error(`Accent ${accent} is not available for ${style}`);
  return accent;
}
