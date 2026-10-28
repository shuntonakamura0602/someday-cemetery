export type AppStage = "local" | "preview" | "production";
export type DataBackend = "demo" | "supabase";
export type PaymentsMode = "off" | "sandbox" | "live";

export type GraveStatus = "published" | "hidden" | "deleted";
export type GraveStyle = "classic" | "moss" | "wildflowers" | "lantern";
export type EntitlementStatus = "active" | "revoked" | "suspended";

export type ClassicAccent = "stone" | "slate" | "moon";
export type MossAccent = "fern" | "sage" | "lichen";
export type WildflowersAccent = "violet" | "gold" | "rose";
export type LanternAccent = "ember" | "amber" | "starlight";
export type GraveAccent =
  | ClassicAccent
  | MossAccent
  | WildflowersAccent
  | LanternAccent;

export interface PublicGraveDto {
  id: string;
  gardenId: string;
  gardenOrdinal?: number;
  plotIndex: number;
  title: string;
  epitaph?: string;
  startedYear?: number;
  buriedAt: string;
  style: GraveStyle;
  accent: GraveAccent;
  flowerCount: number;
  isExample: boolean;
}

export interface OwnerGraveDto extends PublicGraveDto {
  status: GraveStatus;
  selectedStyle: GraveStyle;
  selectedAccent: GraveAccent;
  version: number;
  updatedAt: string;
  hasActiveEntitlement: boolean;
}

export interface CreateGraveInput {
  gardenId: string;
  plotIndex: number;
  title: string;
  epitaph?: string;
  startedYear?: number;
}

export interface UpdateGraveInput {
  title: string;
  epitaph?: string;
  startedYear?: number;
  selectedStyle: GraveStyle;
  accent: GraveAccent;
  version: number;
}

export interface CreatedGraveResult {
  grave: OwnerGraveDto;
  recoveryUrl?: string;
  replayed: boolean;
}

export interface GardenDto {
  id: string;
  ordinal: number;
  name: string;
  capacity: 100;
  layoutVersion: "garden-v1";
  occupiedCount: number;
  occupiedPlotIndexes: number[];
}

export interface GardenPlotDto {
  plotIndex: number;
  occupied: boolean;
  grave?: PublicGraveDto;
}

export interface FlowerResult {
  flowerCount: number;
  added: boolean;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "personal_information"
  | "real_person"
  | "other";

export interface MemorialImageModel {
  serviceName: "Someday Cemetery";
  title: string;
  epitaph?: string;
  startedYear?: number;
  buriedDate: string;
  style: GraveStyle;
  accent: GraveAccent;
  isExample: boolean;
}
