import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { UserRow } from "@/lib/db/schema";

import { SESSION_TTL_MS, getUserForSessionToken } from "./accounts";

/**
 * The signed-in session cookie. Separate from `lf_owner` (the browser identity
 * that owns purchases and monitors): signing out clears this one only, so the
 * browser keeps access to what it already had.
 */
export const SESSION_COOKIE = "lf_session";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function sessionTokenFromRequest(request: Request): string | null {
  return readCookie(request.headers.get("cookie"), SESSION_COOKIE);
}

/** The signed-in user for a route handler, or null. */
export async function userFromRequest(request: Request): Promise<UserRow | null> {
  return getUserForSessionToken(sessionTokenFromRequest(request));
}

/** The signed-in user for a server component. Makes the page dynamic. */
export async function getCurrentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserForSessionToken(token);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * A same-origin path to continue to after sign-in. Anything that could leave
 * the site (`//evil.test`, `/\evil.test`, absolute URLs) falls back.
 */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
