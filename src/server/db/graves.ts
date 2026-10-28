import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  DESIGNS,
  buildRecoveryUrl,
  getDefaultAccent,
  getEffectiveAccent,
  getEffectiveStyle,
  type CreateGraveInput,
  type CreatedGraveResult,
  type GardenDto,
  type GardenPlotDto,
  type GraveAccent,
  type GraveStatus,
  type GraveStyle,
  type OwnerGraveDto,
  type PublicGraveDto,
  type UpdateGraveInput,
} from "@/domain";
import { ApiError } from "@/server/api-errors";
import { getServerEnv } from "@/server/env";
import { purposeHash } from "@/server/security/visitor";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

type GraveRow = {
  id: string;
  garden_id: string | null;
  plot_index: number | null;
  owner_user_id: string | null;
  title: string | null;
  epitaph: string | null;
  started_year: number | null;
  selected_style: string;
  accent: string;
  status: GraveStatus;
  is_example: boolean;
  version: number;
  flower_count: number;
  created_at: string;
  updated_at: string;
};

const PUBLIC_COLUMNS =
  "id,garden_id,plot_index,title,epitaph,started_year,selected_style,accent,status,is_example,version,flower_count,created_at,updated_at";
const OWNER_COLUMNS = `${PUBLIC_COLUMNS},owner_user_id`;

function requireSupabase() {
  if (getServerEnv().DATA_BACKEND !== "supabase") {
    throw new ApiError(400, "DEMO_CLIENT_ONLY", "Demo changes stay in this browser.");
  }
  return getSupabaseAdminClient();
}

function style(value: string): GraveStyle {
  return value in DESIGNS ? (value as GraveStyle) : "classic";
}

function accent(value: string, chosenStyle: GraveStyle): GraveAccent {
  return getEffectiveAccent(chosenStyle, value as GraveAccent);
}

async function activeEntitlementIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const db = requireSupabase();
  const { data, error } = await db
    .from("grave_entitlements")
    .select("grave_id")
    .in("grave_id", ids)
    .eq("mode", getServerEnv().entitlementMode)
    .eq("status", "active");
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The garden could not be loaded.");
  return new Set((data ?? []).map((row) => String(row.grave_id)));
}

function publicDto(row: GraveRow, gardenOrdinal: number, activeEntitlement: boolean): PublicGraveDto {
  const selected = style(row.selected_style);
  const effective = getEffectiveStyle(selected, activeEntitlement, row.is_example);
  return {
    id: row.id,
    gardenId: row.garden_id!,
    gardenOrdinal,
    plotIndex: row.plot_index!,
    title: row.title!,
    ...(row.epitaph ? { epitaph: row.epitaph } : {}),
    ...(row.started_year ? { startedYear: row.started_year } : {}),
    buriedAt: row.created_at,
    style: effective,
    accent: effective === selected ? accent(row.accent, effective) : getDefaultAccent("classic"),
    flowerCount: row.flower_count,
    isExample: row.is_example,
  };
}

function ownerDto(row: GraveRow, gardenOrdinal: number, activeEntitlement: boolean): OwnerGraveDto {
  const publicGrave = publicDto(row, gardenOrdinal, activeEntitlement);
  const selectedStyle = style(row.selected_style);
  return {
    ...publicGrave,
    status: row.status,
    selectedStyle,
    selectedAccent: accent(row.accent, selectedStyle),
    version: row.version,
    updatedAt: row.updated_at,
    hasActiveEntitlement: activeEntitlement,
  };
}

async function gardenOrdinals(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const { data, error } = await requireSupabase().from("gardens").select("id,ordinal").in("id", ids);
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The garden could not be loaded.");
  return new Map((data ?? []).map((garden) => [String(garden.id), Number(garden.ordinal)]));
}

async function rowsToPublic(rows: GraveRow[]) {
  const [entitlements, ordinals] = await Promise.all([
    activeEntitlementIds(rows.map((row) => row.id)),
    gardenOrdinals([...new Set(rows.flatMap((row) => (row.garden_id ? [row.garden_id] : [])))]),
  ]);
  return rows.map((row) => publicDto(row, ordinals.get(row.garden_id!) ?? 1, entitlements.has(row.id)));
}

async function rowsToOwner(rows: GraveRow[]) {
  const [entitlements, ordinals] = await Promise.all([
    activeEntitlementIds(rows.map((row) => row.id)),
    gardenOrdinals([...new Set(rows.flatMap((row) => (row.garden_id ? [row.garden_id] : [])))]),
  ]);
  return rows.map((row) => ownerDto(row, ordinals.get(row.garden_id!) ?? 1, entitlements.has(row.id)));
}

export async function listGardens(): Promise<GardenDto[]> {
  const db = requireSupabase();
  const [{ data: gardens, error: gardenError }, { data: graves, error: graveError }] = await Promise.all([
    db.from("gardens").select("id,ordinal,capacity,layout_version").order("ordinal"),
    db.from("graves").select("garden_id,plot_index").in("status", ["published", "hidden"]),
  ]);
  if (gardenError || graveError) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The gardens could not be loaded.");
  const occupancy = new Map<string, number[]>();
  for (const grave of graves ?? []) {
    if (grave.garden_id == null || grave.plot_index == null) continue;
    const indexes = occupancy.get(String(grave.garden_id)) ?? [];
    indexes.push(Number(grave.plot_index));
    occupancy.set(String(grave.garden_id), indexes);
  }
  return (gardens ?? []).map((garden) => {
    const indexes = (occupancy.get(String(garden.id)) ?? []).sort((a, b) => a - b);
    return {
      id: String(garden.id),
      ordinal: Number(garden.ordinal),
      name: `Garden ${garden.ordinal}`,
      capacity: 100,
      layoutVersion: "garden-v1",
      occupiedCount: indexes.length,
      occupiedPlotIndexes: indexes,
    };
  });
}

export async function listGardenPlots(gardenId: string): Promise<GardenPlotDto[]> {
  const db = requireSupabase();
  const { data: garden, error: gardenError } = await db.from("gardens").select("ordinal").eq("id", gardenId).maybeSingle();
  if (gardenError || !garden) throw new ApiError(404, "GARDEN_UNAVAILABLE", "This garden isn’t available.");
  const { data, error } = await db
    .from("graves")
    .select(PUBLIC_COLUMNS)
    .eq("garden_id", gardenId)
    .in("status", ["published", "hidden"])
    .order("plot_index");
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "This garden could not be loaded.");
  const rows = (data ?? []) as unknown as GraveRow[];
  const publicRows = rows.filter((row) => row.status === "published");
  const publicDtos = await rowsToPublic(publicRows);
  const dtoByPlot = new Map(publicDtos.map((grave) => [grave.plotIndex, grave]));
  const occupied = new Set(rows.map((row) => row.plot_index!));
  return Array.from({ length: 100 }, (_, plotIndex) => ({
    plotIndex,
    occupied: occupied.has(plotIndex),
    ...(dtoByPlot.has(plotIndex) ? { grave: dtoByPlot.get(plotIndex)! } : {}),
  }));
}

type Cursor = { createdAt: string; id: string };
const cursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
}).strict();

export function decodeRecentCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export async function listRecentGraves(limit: number, cursorValue: string | null) {
  const db = requireSupabase();
  const cursor = decodeRecentCursor(cursorValue);
  if (cursorValue && !cursor) throw new ApiError(400, "INVALID_CURSOR", "The page cursor is invalid.");
  let query = db
    .from("graves")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .eq("is_example", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Recent graves could not be loaded.");
  const rows = (data ?? []) as unknown as GraveRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = await rowsToPublic(pageRows);
  const last = pageRows.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null };
}

export async function getPublicGrave(id: string): Promise<PublicGraveDto | null> {
  const { data, error } = await requireSupabase()
    .from("graves")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The grave could not be loaded.");
  if (!data) return null;
  return (await rowsToPublic([data as unknown as GraveRow]))[0] ?? null;
}

export async function getRandomGrave() {
  const db = requireSupabase();
  const { data, error } = await db.rpc("get_random_published_grave");
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "A random grave could not be found.");
  const id = Array.isArray(data) ? data[0]?.grave_id : null;
  return id ? getPublicGrave(String(id)) : null;
}

export async function listOwnerGraves(ownerUserId: string) {
  const { data, error } = await requireSupabase()
    .from("graves")
    .select(OWNER_COLUMNS)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["published", "hidden"])
    .eq("is_example", false)
    .order("created_at", { ascending: false });
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Your graves could not be loaded.");
  return rowsToOwner((data ?? []) as unknown as GraveRow[]);
}

export async function getOwnerGrave(id: string, ownerUserId: string) {
  const { data, error } = await requireSupabase()
    .from("graves")
    .select(OWNER_COLUMNS)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["published", "hidden"])
    .eq("is_example", false)
    .maybeSingle();
  if (error) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The grave could not be loaded.");
  if (!data) return null;
  return (await rowsToOwner([data as unknown as GraveRow]))[0] ?? null;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tokenPair() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hash(token) };
}

export function mapDatabaseError(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? "";
  if (message.includes("PLOT_TAKEN")) throw new ApiError(409, "PLOT_TAKEN", "Someone else took this plot. Your draft is safe. Choose another spot.");
  if (message.includes("IDEMPOTENCY_CONFLICT")) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for different content.");
  if (message.includes("VERSION_CONFLICT")) throw new ApiError(409, "VERSION_CONFLICT", "This grave has changed. Review the latest version before saving.");
  if (message.includes("RATE_LIMITED")) throw new ApiError(429, "RATE_LIMITED", "Please wait a little before trying again.", undefined, 60);
  if (message.includes("RECOVERY_INVALID") || message.includes("INVALID_RECOVERY")) throw new ApiError(400, "RECOVERY_INVALID", "This recovery link is invalid or has been replaced.");
  if (message.includes("ENTITLEMENT_REQUIRED")) throw new ApiError(403, "ENTITLEMENT_REQUIRED", "This design has not been unlocked for this grave.");
  if (message.includes("FORBIDDEN") || error?.code === "42501") throw new ApiError(403, "FORBIDDEN", "You do not have access to this grave.");
  if (message.includes("GRAVE_UNAVAILABLE")) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
  if (message.includes("NO_STATE_CHANGE")) throw new ApiError(409, "NO_STATE_CHANGE", "That item is already in this state.");
  throw new ApiError(503, "SERVICE_UNAVAILABLE", "Something went wrong. Your draft is safe. Please try again.");
}

export async function consumeRateLimit(action: string, subjectHash: string, max: number, windowSeconds: number) {
  const { data, error } = await requireSupabase().rpc("consume_rate_limit", {
    p_action: action,
    p_subject_hash: subjectHash,
    p_limit: max,
    p_window_seconds: windowSeconds,
  });
  if (error) mapDatabaseError(error);
  if (!data) throw new ApiError(429, "RATE_LIMITED", "Please wait a little before trying again.", undefined, windowSeconds);
}

export async function createGrave(
  ownerUserId: string,
  input: CreateGraveInput,
  idempotencyKey: string,
  clientIp: string,
): Promise<CreatedGraveResult> {
  await consumeRateLimit("grave_create_owner", purposeHash(ownerUserId, "create-owner"), 3, 86_400);
  await consumeRateLimit("grave_create_ip", purposeHash(clientIp, `create-ip:${new Date().toISOString().slice(0, 10)}`), 10, 3_600);
  const recovery = tokenPair();
  const payloadHash = hash(JSON.stringify(input));
  const { data, error } = await requireSupabase().rpc("create_grave", {
    p_owner_user_id: ownerUserId,
    p_garden_id: input.gardenId,
    p_plot_index: input.plotIndex,
    p_title: input.title,
    p_epitaph: input.epitaph ?? null,
    p_started_year: input.startedYear ?? null,
    p_style: "classic",
    p_accent: "stone",
    p_recovery_token_hash: recovery.tokenHash,
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
  });
  if (error) mapDatabaseError(error);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.grave_id) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The grave could not be created.");
  const grave = await getOwnerGrave(String(result.grave_id), ownerUserId);
  if (!grave) throw new ApiError(503, "SERVICE_UNAVAILABLE", "The created grave could not be loaded.");
  const replayed = Boolean(result.replayed);
  return {
    grave,
    replayed,
    ...(!replayed ? { recoveryUrl: buildRecoveryUrl(getServerEnv().APP_BASE_URL, grave.id, recovery.token) } : {}),
  };
}

export async function updateGrave(id: string, ownerUserId: string, input: UpdateGraveInput) {
  await consumeRateLimit("grave_edit", purposeHash(ownerUserId, "edit-owner"), 10, 60);
  const { error } = await requireSupabase().rpc("update_grave", {
    p_grave_id: id,
    p_owner_user_id: ownerUserId,
    p_expected_version: input.version,
    p_title: input.title,
    p_epitaph: input.epitaph ?? null,
    p_started_year: input.startedYear ?? null,
    p_style: input.selectedStyle,
    p_accent: input.accent,
    p_entitlement_mode: getServerEnv().entitlementMode,
  });
  if (error) mapDatabaseError(error);
  const grave = await getOwnerGrave(id, ownerUserId);
  if (!grave) throw new ApiError(404, "GRAVE_UNAVAILABLE", "This grave isn’t available.");
  return grave;
}

export async function deleteGrave(id: string, ownerUserId: string, version: number) {
  const { error } = await requireSupabase().rpc("delete_grave_and_scrub", {
    p_grave_id: id,
    p_owner_user_id: ownerUserId,
    p_expected_version: version,
  });
  if (error) mapDatabaseError(error);
}

export async function rotateRecoveryLink(id: string, ownerUserId: string) {
  const recovery = tokenPair();
  const { error } = await requireSupabase().rpc("rotate_recovery_token", {
    p_grave_id: id,
    p_owner_user_id: ownerUserId,
    p_new_token_hash: recovery.tokenHash,
  });
  if (error) mapDatabaseError(error);
  return buildRecoveryUrl(getServerEnv().APP_BASE_URL, id, recovery.token);
}

export async function restoreOwnership(id: string, oldToken: string, newOwnerUserId: string, clientIp: string) {
  await consumeRateLimit("recovery_failure", purposeHash(clientIp, "recovery-ip"), 10, 3_600);
  const recovery = tokenPair();
  const { error } = await requireSupabase().rpc("restore_grave_ownership", {
    p_grave_id: id,
    p_old_token_hash: hash(oldToken),
    p_new_owner_user_id: newOwnerUserId,
    p_new_token_hash: recovery.tokenHash,
  });
  if (error) mapDatabaseError(error);
  const grave = await getOwnerGrave(id, newOwnerUserId);
  if (!grave) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Editing access could not be restored.");
  return { grave, recoveryUrl: buildRecoveryUrl(getServerEnv().APP_BASE_URL, id, recovery.token) };
}

export async function leaveFlower(id: string, visitorHash: string) {
  const { data, error } = await requireSupabase().rpc("leave_flower", {
    p_grave_id: id,
    p_visitor_hash: visitorHash,
  });
  if (error) mapDatabaseError(error);
  const result = Array.isArray(data) ? data[0] : data;
  return { flowerCount: Number(result?.flower_count ?? 0), added: Boolean(result?.added) };
}

export async function createReport(
  id: string,
  reporterHash: string,
  rateSubjectHash: string,
  reason: string,
  details: string | undefined,
) {
  const { error } = await requireSupabase().rpc("create_report", {
    p_grave_id: id,
    p_reporter_hash: reporterHash,
    p_reason: reason,
    p_details: details ?? null,
    p_rate_subject_hash: rateSubjectHash,
  });
  if (error) mapDatabaseError(error);
}

export async function getOwnerKeepsakeGrave(id: string, ownerUserId: string) {
  const grave = await getOwnerGrave(id, ownerUserId);
  if (!grave || !grave.hasActiveEntitlement) return null;
  return { ...grave, style: grave.selectedStyle, accent: grave.selectedAccent } satisfies PublicGraveDto;
}
