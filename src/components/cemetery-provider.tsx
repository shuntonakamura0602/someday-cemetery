"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useRuntimeConfig } from "@/components/runtime-config";
import type {
  CreateGraveInput,
  CreatedGraveResult,
  GardenDto,
  GardenPlotDto,
  OwnerGraveDto,
  PublicGraveDto,
  UpdateGraveInput,
} from "@/domain";
import { getDemoRepository } from "@/demo";

export class ClientApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
  } & T;
  if (!response.ok) {
    throw new ClientApiError(
      body.code ?? "REQUEST_FAILED",
      body.message ?? "Something went wrong. Your draft is safe. Please try again.",
      response.status,
      body.fieldErrors,
    );
  }
  return body;
}

type ReportReason = "spam" | "harassment" | "personal_information" | "real_person" | "other";

type CemeteryContextValue = {
  loading: boolean;
  error: string | null;
  needsAnonymousSession: boolean;
  gardens: GardenDto[];
  currentGarden: GardenDto | null;
  plots: GardenPlotDto[];
  recent: PublicGraveDto[];
  owned: OwnerGraveDto[];
  selectGarden: (gardenId: string) => Promise<void>;
  refresh: () => Promise<void>;
  getGrave: (id: string) => Promise<PublicGraveDto | null>;
  getOwnerGrave: (id: string) => Promise<OwnerGraveDto | null>;
  createGrave: (input: CreateGraveInput, idempotencyKey: string, captchaToken?: string) => Promise<CreatedGraveResult>;
  updateGrave: (id: string, input: UpdateGraveInput) => Promise<OwnerGraveDto>;
  deleteGrave: (id: string, version: number) => Promise<void>;
  leaveFlower: (id: string) => Promise<{ flowerCount: number; added: boolean }>;
  randomGrave: () => Promise<PublicGraveDto | null>;
  rotateRecoveryLink: (id: string) => Promise<string>;
  recover: (id: string, key: string, captchaToken?: string) => Promise<{ grave: OwnerGraveDto; recoveryUrl: string }>;
  report: (id: string, reason: ReportReason, details?: string, turnstileToken?: string) => Promise<void>;
};

const CemeteryContext = createContext<CemeteryContextValue | null>(null);

export function CemeteryProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntimeConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gardens, setGardens] = useState<GardenDto[]>([]);
  const [currentGardenId, setCurrentGardenId] = useState<string | null>(null);
  const [plots, setPlots] = useState<GardenPlotDto[]>([]);
  const [recent, setRecent] = useState<PublicGraveDto[]>([]);
  const [owned, setOwned] = useState<OwnerGraveDto[]>([]);
  const [hasRemoteSession, setHasRemoteSession] = useState<boolean | null>(null);
  const currentGardenIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentGardenIdRef.current = currentGardenId;
  }, [currentGardenId]);

  const syncDemo = useCallback(() => {
    const repo = getDemoRepository();
    const nextGardens = repo.getGardens();
    const selected =
      nextGardens.find((garden) => garden.id === currentGardenIdRef.current)?.id ?? nextGardens.at(-1)?.id ?? null;
    setGardens(nextGardens);
    setCurrentGardenId(selected);
    setPlots(selected ? repo.listGarden(selected) : []);
    setRecent(repo.recent(20));
    setOwned(repo.myGraves());
    setError(null);
    setLoading(false);
  }, []);

  const refreshRemote = useCallback(async () => {
    const gardenResult = await api<{ gardens: GardenDto[] }>("/api/gardens");
    const selected =
      gardenResult.gardens.find((garden) => garden.id === currentGardenIdRef.current)?.id ??
      gardenResult.gardens.at(-1)?.id ??
      null;
    const [plotResult, recentResult, ownerResult] = await Promise.all([
      selected
        ? api<{ plots: GardenPlotDto[] }>(`/api/gardens/${encodeURIComponent(selected)}/graves`)
        : Promise.resolve({ plots: [] }),
      api<{ items: PublicGraveDto[] }>("/api/graves?limit=20"),
      api<{ items: OwnerGraveDto[] }>("/api/me/graves")
        .then((result) => ({ ...result, hasSession: true as const }))
        .catch((requestError) => {
          if (requestError instanceof ClientApiError && requestError.status === 401) {
            return { items: [], hasSession: false as const };
          }
          throw requestError;
        }),
    ]);
    setGardens(gardenResult.gardens);
    setCurrentGardenId(selected);
    setPlots(plotResult.plots);
    setRecent(recentResult.items);
    setOwned(ownerResult.items);
    setHasRemoteSession(ownerResult.hasSession);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (runtime.dataBackend === "demo") syncDemo();
      else await refreshRemote();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "The garden could not be loaded.");
      setLoading(false);
    }
  }, [refreshRemote, runtime.dataBackend, syncDemo]);

  useEffect(() => {
    if (runtime.dataBackend === "demo") {
      const unsubscribe = getDemoRepository().subscribe(syncDemo);
      const timer = window.setTimeout(syncDemo, 0);
      return () => {
        window.clearTimeout(timer);
        unsubscribe();
      };
    }
    const timer = window.setTimeout(() => {
      void refreshRemote().catch((refreshError) => {
        setError(refreshError instanceof Error ? refreshError.message : "The garden could not be loaded.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshRemote, runtime.dataBackend, syncDemo]);

  const selectGarden = useCallback(
    async (gardenId: string) => {
      setCurrentGardenId(gardenId);
      currentGardenIdRef.current = gardenId;
      if (runtime.dataBackend === "demo") setPlots(getDemoRepository().listGarden(gardenId));
      else {
        const result = await api<{ plots: GardenPlotDto[] }>(
          `/api/gardens/${encodeURIComponent(gardenId)}/graves`,
        );
        setPlots(result.plots);
      }
    },
    [runtime.dataBackend],
  );

  const ensureRemoteSession = useCallback(async (captchaToken?: string) => {
    await api<{ userId: string }>("/api/session/anonymous", {
      method: "POST",
      body: JSON.stringify({ captchaToken }),
    });
    setHasRemoteSession(true);
  }, []);

  const getGrave = useCallback(
    async (id: string) => {
      if (runtime.dataBackend === "demo") return getDemoRepository().getGrave(id);
      try {
        return (await api<{ grave: PublicGraveDto }>(`/api/graves/${encodeURIComponent(id)}`)).grave;
      } catch (requestError) {
        if (requestError instanceof ClientApiError && requestError.status === 404) return null;
        throw requestError;
      }
    },
    [runtime.dataBackend],
  );

  const getOwnerGrave = useCallback(
    async (id: string) => {
      if (runtime.dataBackend === "demo") return getDemoRepository().getOwnerGrave(id);
      try {
        return (await api<{ grave: OwnerGraveDto }>(`/api/me/graves/${encodeURIComponent(id)}`)).grave;
      } catch (requestError) {
        if (requestError instanceof ClientApiError && [401, 403, 404].includes(requestError.status)) return null;
        throw requestError;
      }
    },
    [runtime.dataBackend],
  );

  const createGrave = useCallback(
    async (input: CreateGraveInput, idempotencyKey: string, captchaToken?: string) => {
      if (runtime.dataBackend === "demo") {
        return getDemoRepository().create(input, { idempotencyKey, baseUrl: window.location.origin });
      }
      await ensureRemoteSession(captchaToken);
      const result = await api<CreatedGraveResult>("/api/graves", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      });
      await refreshRemote();
      return result;
    },
    [ensureRemoteSession, refreshRemote, runtime.dataBackend],
  );

  const updateGrave = useCallback(
    async (id: string, input: UpdateGraveInput) => {
      const grave =
        runtime.dataBackend === "demo"
          ? await getDemoRepository().update(id, input)
          : (
              await api<{ grave: OwnerGraveDto }>(`/api/graves/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify(input),
              })
            ).grave;
      if (runtime.dataBackend !== "demo") await refreshRemote();
      return grave;
    },
    [refreshRemote, runtime.dataBackend],
  );

  const deleteGrave = useCallback(
    async (id: string, version: number) => {
      if (runtime.dataBackend === "demo") await getDemoRepository().delete(id, version);
      else {
        await api(`/api/graves/${encodeURIComponent(id)}`, {
          method: "DELETE",
          body: JSON.stringify({ version }),
        });
        await refreshRemote();
      }
    },
    [refreshRemote, runtime.dataBackend],
  );

  const leaveFlower = useCallback(
    async (id: string) => {
      if (runtime.dataBackend === "demo") return getDemoRepository().leaveFlower(id);
      return api<{ flowerCount: number; added: boolean }>(`/api/graves/${encodeURIComponent(id)}/flowers`, {
        method: "POST",
        body: "{}",
      });
    },
    [runtime.dataBackend],
  );

  const randomGrave = useCallback(async () => {
    if (runtime.dataBackend === "demo") return getDemoRepository().random();
    return (await api<{ grave: PublicGraveDto | null }>("/api/graves/random")).grave;
  }, [runtime.dataBackend]);

  const rotateRecoveryLink = useCallback(
    async (id: string) => {
      if (runtime.dataBackend === "demo") {
        return (await getDemoRepository().rotateRecoveryLink(id, { baseUrl: window.location.origin })).recoveryUrl;
      }
      return (
        await api<{ recoveryUrl: string }>(`/api/graves/${encodeURIComponent(id)}/recovery-link`, {
          method: "POST",
          body: "{}",
        })
      ).recoveryUrl;
    },
    [runtime.dataBackend],
  );

  const recover = useCallback(
    async (id: string, key: string, captchaToken?: string) => {
      if (runtime.dataBackend === "demo") {
        const result = await getDemoRepository().recover(id, key, { baseUrl: window.location.origin });
        return { grave: result.grave, recoveryUrl: result.recoveryUrl };
      }
      await ensureRemoteSession(captchaToken);
      return api<{ grave: OwnerGraveDto; recoveryUrl: string }>("/api/recover", {
        method: "POST",
        body: JSON.stringify({ graveId: id, key }),
      });
    },
    [ensureRemoteSession, runtime.dataBackend],
  );

  const report = useCallback(
    async (id: string, reason: ReportReason, details?: string, turnstileToken?: string) => {
      if (runtime.dataBackend === "demo") {
        getDemoRepository().reportGrave(id);
        return;
      }
      await api(`/api/graves/${encodeURIComponent(id)}/reports`, {
        method: "POST",
        body: JSON.stringify({ reason, details, turnstileToken }),
      });
    },
    [runtime.dataBackend],
  );

  const value = useMemo<CemeteryContextValue>(
    () => ({
      loading,
      error,
      needsAnonymousSession: runtime.dataBackend === "supabase" && hasRemoteSession === false,
      gardens,
      currentGarden: gardens.find((garden) => garden.id === currentGardenId) ?? null,
      plots,
      recent,
      owned,
      selectGarden,
      refresh,
      getGrave,
      getOwnerGrave,
      createGrave,
      updateGrave,
      deleteGrave,
      leaveFlower,
      randomGrave,
      rotateRecoveryLink,
      recover,
      report,
    }),
    [
      loading,
      error,
      hasRemoteSession,
      gardens,
      currentGardenId,
      plots,
      recent,
      owned,
      selectGarden,
      refresh,
      getGrave,
      getOwnerGrave,
      createGrave,
      updateGrave,
      deleteGrave,
      leaveFlower,
      randomGrave,
      rotateRecoveryLink,
      recover,
      report,
      runtime.dataBackend,
    ],
  );

  return <CemeteryContext value={value}>{children}</CemeteryContext>;
}

export function useCemetery() {
  const value = useContext(CemeteryContext);
  if (!value) throw new Error("CemeteryProvider is missing.");
  return value;
}
