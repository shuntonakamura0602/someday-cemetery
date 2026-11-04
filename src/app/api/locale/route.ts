import { NextResponse } from "next/server";

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isLocale(body?.locale)) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "Choose English or Japanese." }, { status: 400 });
  }

  const response = NextResponse.json({ locale: body.locale }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(LOCALE_COOKIE, body.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
  return response;
}
