import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_GARDEN_ID, EXAMPLE_GRAVES, parseRecoveryFragment } from "../../src/domain";
import { DemoRepository, DemoStoreError } from "../../src/demo";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let storage: MemoryStorage;
let sequence: number;
let repository: DemoRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  sequence = 1;
  repository = new DemoRepository(storage, {
    baseUrl: "https://cemetery.example",
    now: () => new Date("2026-10-28T10:00:00.000Z"),
    random: () => 0,
    randomUUID: () => `30000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
  });
});

function input(plotIndex = 0) {
  return { gardenId: DEMO_GARDEN_ID, plotIndex, title: "Quiet little app", epitaph: "It taught me enough.", startedYear: 2024 };
}

describe("DemoRepository", () => {
  it("starts with explicit examples and no fake recent activity", () => {
    expect(repository.getGardens()[0].occupiedCount).toBe(12);
    expect(repository.snapshot().graves).toHaveLength(12);
    expect(repository.recent()).toEqual([]);
    expect(repository.myGraves()).toEqual([]);
    expect(repository.random()?.isExample).toBe(true);
  });

  it("creates a free grave and returns a separate private recovery link", async () => {
    const result = await repository.create(input(), { idempotencyKey: "one" });
    expect(result.grave.title).toBe("Quiet little app");
    expect(result.grave.style).toBe("classic");
    expect(result.replayed).toBe(false);
    expect(new URL(result.recoveryUrl!).search).toBe("");
    expect(parseRecoveryFragment(new URL(result.recoveryUrl!).hash)?.graveId).toBe(result.grave.id);
    expect(repository.myGraves()).toHaveLength(1);
    expect(repository.recent()).toHaveLength(1);
  });

  it("protects occupied plots and keeps idempotent retries singular", async () => {
    await expect(repository.create(input(EXAMPLE_GRAVES[0].plotIndex))).rejects.toMatchObject({ code: "PLOT_TAKEN" });
    const first = await repository.create(input(0), { idempotencyKey: "same" });
    const retry = await repository.create(input(0), { idempotencyKey: "same" });
    expect(retry.grave.id).toBe(first.grave.id);
    expect(retry.replayed).toBe(true);
    expect(repository.recent()).toHaveLength(1);
    await expect(repository.create({ ...input(1), title: "Different" }, { idempotencyKey: "same" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("uses optimistic versions and never publishes paid demo previews", async () => {
    const created = await repository.create(input());
    const updated = repository.update(created.grave.id, {
      title: "Updated",
      epitaph: "Still quiet.",
      startedYear: 2025,
      selectedStyle: "classic",
      accent: "moon",
      version: 1,
    });
    expect(updated.version).toBe(2);
    expect(() => repository.update(created.grave.id, { ...updated, title: "Stale", accent: "moon", version: 1 })).toThrowError(DemoStoreError);
    expect(() => repository.update(created.grave.id, { ...updated, selectedStyle: "lantern", accent: "ember", version: 2 })).toThrowError(expect.objectContaining({ code: "PAYMENT_REQUIRED" }));
  });

  it("leaves one flower per browser and blocks examples", async () => {
    const created = await repository.create(input());
    expect(repository.leaveFlower(created.grave.id)).toEqual({ flowerCount: 1, added: true });
    expect(repository.leaveFlower(created.grave.id)).toEqual({ flowerCount: 1, added: false });
    expect(() => repository.leaveFlower(EXAMPLE_GRAVES[0].id)).toThrowError(expect.objectContaining({ code: "GRAVE_UNAVAILABLE" }));
  });

  it("rotates recovery secrets and invalidates the previous link", async () => {
    const created = await repository.create(input());
    const first = parseRecoveryFragment(new URL(created.recoveryUrl!).hash)!;
    const recovered = await repository.recover(first.graveId, first.key);
    const second = parseRecoveryFragment(new URL(recovered.recoveryUrl).hash)!;
    expect(second.key).not.toBe(first.key);
    await expect(repository.recover(first.graveId, first.key)).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
    const rotated = await repository.rotateRecoveryLink(first.graveId);
    expect(parseRecoveryFragment(new URL(rotated.recoveryUrl).hash)?.key).not.toBe(second.key);
  });

  it("scrubs deleted content and releases the plot", async () => {
    const created = await repository.create(input());
    repository.delete(created.grave.id, created.grave.version);
    expect(repository.getGrave(created.grave.id)).toBeNull();
    expect(repository.myGraves()).toEqual([]);
    expect(repository.listGarden(DEMO_GARDEN_ID)[0].occupied).toBe(false);
    const replacement = await repository.create({ ...input(), title: "A new thing" });
    expect(replacement.grave.id).not.toBe(created.grave.id);
  });
});
