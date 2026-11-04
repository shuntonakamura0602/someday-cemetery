import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

export const getServerLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get("accept-language"));
});
