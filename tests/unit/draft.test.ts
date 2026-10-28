import { describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "../../src/demo";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("session draft", () => {
  it("round-trips only public form fields and clears explicitly", () => {
    const storage = new MemoryStorage();
    saveDraft({ title: "Draft", epitaph: "Words", startedYear: "2024", plotIndex: 4 }, storage);
    expect(loadDraft(storage)).toEqual({ title: "Draft", epitaph: "Words", startedYear: "2024", plotIndex: 4 });
    expect(storage.getItem("someday-cemetery:create-draft:v1")).not.toContain("recovery");
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual({ title: "", epitaph: "", startedYear: "" });
  });
});
