"use client";

const DRAFT_KEY = "someday-cemetery:create-draft:v1";

export interface DemoDraft {
  gardenId?: string;
  plotIndex?: number;
  title: string;
  epitaph: string;
  startedYear: string;
}

export const EMPTY_DRAFT: DemoDraft = { title: "", epitaph: "", startedYear: "" };

export function loadDraft(storage: Storage = window.sessionStorage): DemoDraft {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const value = JSON.parse(raw) as Partial<DemoDraft>;
    return {
      gardenId: typeof value.gardenId === "string" ? value.gardenId : undefined,
      plotIndex: Number.isInteger(value.plotIndex) ? value.plotIndex : undefined,
      title: typeof value.title === "string" ? value.title : "",
      epitaph: typeof value.epitaph === "string" ? value.epitaph : "",
      startedYear: typeof value.startedYear === "string" ? value.startedYear : "",
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveDraft(draft: DemoDraft, storage: Storage = window.sessionStorage): void {
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(storage: Storage = window.sessionStorage): void {
  storage.removeItem(DRAFT_KEY);
}
