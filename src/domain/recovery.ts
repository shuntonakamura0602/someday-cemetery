export interface RecoverySecret { graveId: string; key: string }

export function buildRecoveryUrl(baseUrl: string, graveId: string, key: string): string {
  const url = new URL("/recover", baseUrl);
  url.search = "";
  url.hash = new URLSearchParams({ grave: graveId, key }).toString();
  return url.toString();
}

export function parseRecoveryFragment(fragment: string): RecoverySecret | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const graveId = params.get("grave");
  const key = params.get("key");
  return graveId && key ? { graveId, key } : null;
}

export function clearRecoveryFragment(): void {
  if (typeof window !== "undefined") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
