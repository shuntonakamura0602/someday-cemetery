import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

import { getServerEnv } from "@/server/env";

const COOKIE_NAME = "sc_visitor";

function sign(value: string) {
  const secret = getServerEnv().COOKIE_SIGNING_SECRET;
  if (!secret) throw new Error("COOKIE_SIGNING_SECRET is unavailable.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function readVisitorId(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature) return null;
  const expected = sign(value);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  return value;
}

export function createVisitorId() {
  const value = randomBytes(24).toString("base64url");
  return { value, signed: `${value}.${sign(value)}` };
}

export function setVisitorCookie(response: NextResponse, signed: string) {
  const env = getServerEnv();
  response.cookies.set(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_STAGE !== "local",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function visitorCookieName() {
  return COOKIE_NAME;
}

export function purposeHash(value: string, purpose: string) {
  const secret = getServerEnv().VISITOR_HASH_SECRET;
  if (!secret) throw new Error("VISITOR_HASH_SECRET is unavailable.");
  return createHmac("sha256", secret).update(`${purpose}\0${value}`).digest("hex");
}
