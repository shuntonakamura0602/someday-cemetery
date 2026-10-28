"use client";

import {
  DEMO_GARDEN_ID,
  EXAMPLE_GRAVES,
  GARDEN_CAPACITY,
  GARDEN_LAYOUT_VERSION,
  buildRecoveryUrl,
  gardenIdForOrdinal,
  getDefaultAccent,
  parseCreateGraveInput,
  parseUpdateGraveInput,
  type CreateGraveInput,
  type CreatedGraveResult,
  type FlowerResult,
  type GardenDto,
  type GardenPlotDto,
  type GraveAccent,
  type GraveStatus,
  type GraveStyle,
  type OwnerGraveDto,
  type PublicGraveDto,
  type UpdateGraveInput,
} from "../domain";

const STORAGE_KEY = "someday-cemetery:demo:v1";

export type DemoErrorCode =
  | "PLOT_TAKEN"
  | "VERSION_CONFLICT"
  | "GRAVE_UNAVAILABLE"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYMENT_REQUIRED"
  | "INVALID_RECOVERY";

export class DemoStoreError extends Error {
  constructor(public readonly code: DemoErrorCode, message: string) {
    super(message);
    this.name = "DemoStoreError";
  }
}

interface DemoGraveRecord {
  id: string;
  gardenId: string;
  plotIndex: number;
  ownerId: string;
  title: string;
  epitaph?: string;
  startedYear?: number;
  selectedStyle: GraveStyle;
  accent: GraveAccent;
  status: GraveStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  flowerCount: number;
  recoveryTokenHash?: string;
}

interface IdempotencyRecord {
  payloadHash: string;
  graveId: string;
}

interface DemoStateV1 {
  schemaVersion: 1;
  ownerId: string;
  gardenOrdinals: number[];
  graves: DemoGraveRecord[];
  ownedGraveIds: string[];
  floweredGraveIds: string[];
  reportedGraveIds: string[];
  idempotency: Record<string, IdempotencyRecord>;
}

export interface DemoSnapshot {
  gardens: GardenDto[];
  graves: PublicGraveDto[];
  myGraves: OwnerGraveDto[];
}

interface DemoRepositoryOptions {
  baseUrl?: string;
  now?: () => Date;
  random?: () => number;
  randomUUID?: () => string;
}

function newState(randomUUID: () => string): DemoStateV1 {
  return {
    schemaVersion: 1,
    ownerId: randomUUID(),
    gardenOrdinals: [1],
    graves: [],
    ownedGraveIds: [],
    floweredGraveIds: [],
    reportedGraveIds: [],
    idempotency: {},
  };
}

function isState(value: unknown): value is DemoStateV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoStateV1>;
  return candidate.schemaVersion === 1 && typeof candidate.ownerId === "string"
    && Array.isArray(candidate.gardenOrdinals) && Array.isArray(candidate.graves)
    && Array.isArray(candidate.ownedGraveIds) && Array.isArray(candidate.floweredGraveIds)
    && typeof candidate.idempotency === "object";
}

function publicFromRecord(record: DemoGraveRecord): PublicGraveDto {
  return {
    id: record.id,
    gardenId: record.gardenId,
    gardenOrdinal: Number(record.gardenId.slice(-12)),
    plotIndex: record.plotIndex,
    title: record.title,
    epitaph: record.epitaph,
    startedYear: record.startedYear,
    buriedAt: record.createdAt,
    style: "classic",
    accent: record.selectedStyle === "classic" ? record.accent : getDefaultAccent("classic"),
    flowerCount: record.flowerCount,
    isExample: false,
  };
}

function ownerFromRecord(record: DemoGraveRecord): OwnerGraveDto {
  const publicGrave = publicFromRecord(record);
  return {
    ...publicGrave,
    status: record.status,
    selectedStyle: record.selectedStyle,
    selectedAccent: record.accent,
    version: record.version,
    updatedAt: record.updatedAt,
    hasActiveEntitlement: false,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export class DemoRepository {
  private readonly listeners = new Set<() => void>();
  private readonly now: () => Date;
  private readonly rng: () => number;
  private readonly randomUUID: () => string;
  private readonly baseUrl: string;
  private storageListening = false;

  constructor(private readonly storage: Storage, options: DemoRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.rng = options.random ?? Math.random;
    this.randomUUID = options.randomUUID ?? (() => globalThis.crypto.randomUUID());
    this.baseUrl = options.baseUrl ?? (typeof location === "undefined" ? "http://localhost:3000" : location.origin);
    this.read();
  }

  private read(): DemoStateV1 {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isState(parsed)) {
          parsed.reportedGraveIds ??= [];
          return parsed;
        }
      }
    } catch {
      // A corrupt browser entry should not prevent the local demo from opening.
    }
    const state = newState(this.randomUUID);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  private write(state: DemoStateV1): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    for (const listener of this.listeners) listener();
  }

  private onStorage = (event: StorageEvent): void => {
    if (event.storageArea === this.storage && event.key === STORAGE_KEY) {
      for (const listener of this.listeners) listener();
    }
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!this.storageListening && typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
      this.storageListening = true;
    }
    return () => {
      this.listeners.delete(listener);
      if (this.storageListening && this.listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", this.onStorage);
        this.storageListening = false;
      }
    };
  }

  snapshot(): DemoSnapshot {
    return { gardens: this.getGardens(), graves: this.allPublicGraves(), myGraves: this.myGraves() };
  }

  private allPublicGraves(): PublicGraveDto[] {
    const user = this.read().graves.filter((grave) => grave.status === "published").map(publicFromRecord);
    return [...EXAMPLE_GRAVES, ...user];
  }

  getGardens(): GardenDto[] {
    const state = this.read();
    const all = this.allPublicGraves();
    const hidden = state.graves.filter((grave) => grave.status === "hidden");
    return state.gardenOrdinals.sort((a, b) => a - b).map((ordinal) => {
      const id = gardenIdForOrdinal(ordinal);
      const occupiedPlotIndexes = [
        ...all.filter((grave) => grave.gardenId === id).map((grave) => grave.plotIndex),
        ...hidden.filter((grave) => grave.gardenId === id).map((grave) => grave.plotIndex),
      ].sort((a, b) => a - b);
      return { id, ordinal, name: `Garden ${ordinal}`, capacity: GARDEN_CAPACITY, layoutVersion: GARDEN_LAYOUT_VERSION, occupiedCount: occupiedPlotIndexes.length, occupiedPlotIndexes };
    });
  }

  listGarden(gardenId: string): GardenPlotDto[] {
    const publicByPlot = new Map(this.allPublicGraves().filter((grave) => grave.gardenId === gardenId).map((grave) => [grave.plotIndex, grave]));
    const hiddenPlots = new Set(this.read().graves.filter((grave) => grave.gardenId === gardenId && grave.status === "hidden").map((grave) => grave.plotIndex));
    return Array.from({ length: GARDEN_CAPACITY }, (_, plotIndex) => ({ plotIndex, occupied: publicByPlot.has(plotIndex) || hiddenPlots.has(plotIndex), grave: publicByPlot.get(plotIndex) }));
  }

  getGrave(id: string): PublicGraveDto | null {
    return this.allPublicGraves().find((grave) => grave.id === id) ?? null;
  }

  getOwnerGrave(id: string): OwnerGraveDto | null {
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status !== "deleted");
    return record && record.ownerId === state.ownerId && state.ownedGraveIds.includes(id) ? ownerFromRecord(record) : null;
  }

  recent(limit = 20): PublicGraveDto[] {
    return this.read().graves.filter((grave) => grave.status === "published")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, Math.min(20, Math.max(0, limit))).map(publicFromRecord);
  }

  randomGrave(): PublicGraveDto | null {
    const real = this.recent(20_000);
    const pool = real.length > 0 ? real : [...EXAMPLE_GRAVES];
    return pool.length ? pool[Math.floor(this.rng() * pool.length)] ?? pool[0] : null;
  }

  random(): PublicGraveDto | null { return this.randomGrave(); }

  myGraves(): OwnerGraveDto[] {
    const state = this.read();
    return state.graves.filter((grave) => grave.ownerId === state.ownerId && state.ownedGraveIds.includes(grave.id) && grave.status !== "deleted")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(ownerFromRecord);
  }

  async create(input: CreateGraveInput, options: { idempotencyKey?: string; baseUrl?: string } = {}): Promise<CreatedGraveResult> {
    const normalized = parseCreateGraveInput(input);
    const state = this.read();
    const payloadHash = await sha256(JSON.stringify(normalized));
    if (options.idempotencyKey) {
      const existing = state.idempotency[options.idempotencyKey];
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new DemoStoreError("IDEMPOTENCY_CONFLICT", "This request key was already used for different content.");
        const record = state.graves.find((grave) => grave.id === existing.graveId && grave.status !== "deleted");
        if (!record) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This grave isn’t available.");
        return { grave: ownerFromRecord(record), replayed: true };
      }
    }
    if (!state.gardenOrdinals.some((ordinal) => gardenIdForOrdinal(ordinal) === normalized.gardenId)) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This garden isn’t available.");
    if (this.listGarden(normalized.gardenId)[normalized.plotIndex]?.occupied) throw new DemoStoreError("PLOT_TAKEN", "Someone else took this plot. Your draft is safe. Choose another spot.");
    const token = randomToken();
    const timestamp = this.now().toISOString();
    const record: DemoGraveRecord = {
      ...normalized,
      id: this.randomUUID(),
      ownerId: state.ownerId,
      selectedStyle: "classic",
      accent: "stone",
      status: "published",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      flowerCount: 0,
      recoveryTokenHash: await sha256(token),
    };
    state.graves.push(record);
    state.ownedGraveIds.push(record.id);
    if (options.idempotencyKey) state.idempotency[options.idempotencyKey] = { payloadHash, graveId: record.id };
    const latestOrdinal = Math.max(...state.gardenOrdinals);
    const latestId = gardenIdForOrdinal(latestOrdinal);
    const latestOccupied = this.occupiedCountWith(latestId, state);
    if (latestOccupied >= 80 && !state.gardenOrdinals.includes(latestOrdinal + 1)) state.gardenOrdinals.push(latestOrdinal + 1);
    this.write(state);
    return { grave: ownerFromRecord(record), recoveryUrl: buildRecoveryUrl(options.baseUrl ?? this.baseUrl, record.id, token), replayed: false };
  }

  private occupiedCountWith(gardenId: string, state: DemoStateV1): number {
    const examples = EXAMPLE_GRAVES.filter((grave) => grave.gardenId === gardenId).length;
    return examples + state.graves.filter((grave) => grave.gardenId === gardenId && (grave.status === "published" || grave.status === "hidden")).length;
  }

  update(id: string, input: UpdateGraveInput): OwnerGraveDto {
    const normalized = parseUpdateGraveInput(input);
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status !== "deleted");
    if (!record) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This grave isn’t available.");
    if (record.ownerId !== state.ownerId || !state.ownedGraveIds.includes(id)) throw new DemoStoreError("FORBIDDEN", "You do not own this grave in this browser.");
    if (record.version !== normalized.version) throw new DemoStoreError("VERSION_CONFLICT", "This grave has changed. Review the latest version before saving.");
    if (normalized.selectedStyle !== "classic") throw new DemoStoreError("PAYMENT_REQUIRED", "Paid designs are preview-only in the local demo.");
    record.title = normalized.title;
    record.epitaph = normalized.epitaph;
    record.startedYear = normalized.startedYear;
    record.selectedStyle = "classic";
    record.accent = normalized.accent;
    record.version += 1;
    record.updatedAt = this.now().toISOString();
    this.write(state);
    return ownerFromRecord(record);
  }

  delete(id: string, version: number): void {
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status !== "deleted");
    if (!record) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This grave isn’t available.");
    if (record.ownerId !== state.ownerId || !state.ownedGraveIds.includes(id)) throw new DemoStoreError("FORBIDDEN", "You do not own this grave in this browser.");
    if (record.version !== version) throw new DemoStoreError("VERSION_CONFLICT", "This grave has changed. Review the latest version before saving.");
    record.title = "";
    delete record.epitaph;
    delete record.startedYear;
    delete record.recoveryTokenHash;
    record.status = "deleted";
    record.flowerCount = 0;
    record.version += 1;
    record.updatedAt = this.now().toISOString();
    record.deletedAt = record.updatedAt;
    state.ownedGraveIds = state.ownedGraveIds.filter((graveId) => graveId !== id);
    state.floweredGraveIds = state.floweredGraveIds.filter((graveId) => graveId !== id);
    this.write(state);
  }

  leaveFlower(id: string): FlowerResult {
    if (EXAMPLE_GRAVES.some((grave) => grave.id === id)) throw new DemoStoreError("GRAVE_UNAVAILABLE", "Example graves cannot receive flowers.");
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status === "published");
    if (!record) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This grave isn’t available.");
    if (state.floweredGraveIds.includes(id)) return { flowerCount: record.flowerCount, added: false };
    state.floweredGraveIds.push(id);
    record.flowerCount += 1;
    this.write(state);
    return { flowerCount: record.flowerCount, added: true };
  }

  reportGrave(id: string): { added: boolean } {
    if (!this.getGrave(id) || EXAMPLE_GRAVES.some((grave) => grave.id === id)) throw new DemoStoreError("GRAVE_UNAVAILABLE", "This grave isn’t available.");
    const state = this.read();
    if (state.reportedGraveIds.includes(id)) return { added: false };
    state.reportedGraveIds.push(id);
    this.write(state);
    return { added: true };
  }

  async rotateRecoveryLink(id: string, options: { baseUrl?: string } = {}): Promise<{ recoveryUrl: string }> {
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status !== "deleted");
    if (!record || record.ownerId !== state.ownerId || !state.ownedGraveIds.includes(id)) throw new DemoStoreError("FORBIDDEN", "You do not own this grave in this browser.");
    const token = randomToken();
    record.recoveryTokenHash = await sha256(token);
    record.version += 1;
    record.updatedAt = this.now().toISOString();
    this.write(state);
    return { recoveryUrl: buildRecoveryUrl(options.baseUrl ?? this.baseUrl, id, token) };
  }

  async recover(id: string, key: string, options: { baseUrl?: string } = {}): Promise<{ grave: OwnerGraveDto; recoveryUrl: string }> {
    const state = this.read();
    const record = state.graves.find((grave) => grave.id === id && grave.status !== "deleted");
    if (!record || !record.recoveryTokenHash || await sha256(key) !== record.recoveryTokenHash) throw new DemoStoreError("INVALID_RECOVERY", "This recovery link is invalid or has been replaced.");
    const nextToken = randomToken();
    record.ownerId = state.ownerId;
    record.recoveryTokenHash = await sha256(nextToken);
    record.version += 1;
    record.updatedAt = this.now().toISOString();
    if (!state.ownedGraveIds.includes(id)) state.ownedGraveIds.push(id);
    this.write(state);
    return { grave: ownerFromRecord(record), recoveryUrl: buildRecoveryUrl(options.baseUrl ?? this.baseUrl, id, nextToken) };
  }

  /** Explicit user action for clearing the browser demo, useful in Settings and tests. */
  reset(): void {
    this.write(newState(this.randomUUID));
  }
}

let singleton: DemoRepository | undefined;

export function getDemoRepository(): DemoRepository {
  if (typeof window === "undefined") throw new Error("The demo repository is only available in the browser.");
  singleton ??= new DemoRepository(window.localStorage);
  return singleton;
}

export { DEMO_GARDEN_ID };
