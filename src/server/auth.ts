import "server-only";

import type { User } from "@supabase/supabase-js";

import { ApiError } from "@/server/api-errors";
import { getServerEnv } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function getVerifiedUser(): Promise<User | null> {
  if (getServerEnv().DATA_BACKEND !== "supabase") return null;
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function requireVerifiedUser() {
  const user = await getVerifiedUser();
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Editing access is required.");
  return user;
}

export function isVerifiedPersistentAdmin(user: User, adminUserIds: ReadonlySet<string>) {
  const identityConfirmed = Boolean(
    user.email_confirmed_at || user.phone_confirmed_at || user.confirmed_at,
  );
  return user.is_anonymous !== true && identityConfirmed && adminUserIds.has(user.id);
}

export async function requireAdmin() {
  const user = await requireVerifiedUser();
  const env = getServerEnv();
  if (!isVerifiedPersistentAdmin(user, env.adminUserIds)) {
    throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
  }
  return user;
}
