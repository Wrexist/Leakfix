import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { monitors, type MonitorRow } from "@/lib/db/schema";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

import { generateWebhookSecret } from "./secrets";
import type { ScanKind } from "./types";

/**
 * Browser-scoped monitor ownership.
 *
 * There are no accounts, so a monitor belongs to the browser that created it:
 * the first create sets a random, httpOnly owner cookie and the monitor row
 * stores only a SHA-256 hash of it. Every monitor API route resolves the owner
 * from the cookie and only sees rows with a matching hash. Rows with a NULL
 * owner (created before ownership existed) are invisible to the API; the cron
 * routes still process them.
 */
export const OWNER_COOKIE = "lf_owner";

const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface MonitorOwner {
  id: string;
  hash: string;
}

/** 32 random bytes, base64url encoded (43 chars). */
export function generateOwnerId(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOwnerId(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex");
}

/** Validates a raw cookie value and derives its hash; null when absent/invalid. */
export function ownerFromCookieValue(value: string | null | undefined): MonitorOwner | null {
  if (!value || !OWNER_ID_PATTERN.test(value)) return null;
  return { id: value, hash: hashOwnerId(value) };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function ownerFromRequest(request: Request): MonitorOwner | null {
  return ownerFromCookieValue(readCookie(request.headers.get("cookie"), OWNER_COOKIE));
}

export function setOwnerCookie(response: NextResponse, owner: MonitorOwner): void {
  response.cookies.set(OWNER_COOKIE, owner.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_COOKIE_MAX_AGE,
  });
}

export function monitorNotFound(): NextResponse {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Monitor not found." } },
    { status: 404 },
  );
}

/**
 * Applies per-owner and per-IP fixed-window limits for one action bucket.
 * Returns a 429 response when either is exhausted, otherwise null.
 */
export function limitMonitorAction(
  request: Request,
  owner: MonitorOwner | null,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): NextResponse | null {
  const results = [checkRateLimit(`monitors:${bucket}:ip:${clientIp(request)}`, limit, windowMs)];
  if (owner) results.push(checkRateLimit(`monitors:${bucket}:owner:${owner.hash}`, limit, windowMs));

  const blocked = results.find((result) => !result.allowed);
  if (!blocked) return null;
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please wait a moment and try again.",
      },
    },
    {
      status: 429,
      headers: { "retry-after": String(Math.max(1, Math.ceil(blocked.retryAfterMs / 1000))) },
    },
  );
}

export async function listMonitorsForOwner(ownerHash: string): Promise<MonitorRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(monitors)
    .where(eq(monitors.ownerHash, ownerHash))
    .orderBy(desc(monitors.createdAt));
}

/** The monitor with this id, only if it belongs to the owner. */
export async function getMonitorForOwner(id: string, ownerHash: string): Promise<MonitorRow | null> {
  const { db } = await getDb();
  const rows = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.ownerHash, ownerHash)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMonitorForOwnerByUrl(
  normalizedUrl: string,
  ownerHash: string,
): Promise<MonitorRow | null> {
  const { db } = await getDb();
  const rows = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.normalizedUrl, normalizedUrl), eq(monitors.ownerHash, ownerHash)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Creates a monitor owned by `ownerHash`. Idempotent per (owner, URL): a
 * concurrent duplicate returns the existing row with `created: false`.
 */
export async function createMonitorForOwner(input: {
  ownerHash: string;
  normalizedUrl: string;
  kind: ScanKind;
  label?: string | null;
}): Promise<{ row: MonitorRow; created: boolean }> {
  const { db } = await getDb();
  const [row] = await db
    .insert(monitors)
    .values({
      ownerHash: input.ownerHash,
      normalizedUrl: input.normalizedUrl,
      kind: input.kind,
      label: input.label ?? null,
      webhookSecret: generateWebhookSecret(),
    })
    .onConflictDoNothing()
    .returning();
  if (row) return { row, created: true };

  const existing = await getMonitorForOwnerByUrl(input.normalizedUrl, input.ownerHash);
  if (!existing) throw new Error("Monitor insert conflicted but no existing row was found.");
  return { row: existing, created: false };
}

/** Every monitor (any owner, including legacy rows) for a URL. Server-side only. */
export async function listMonitorsByUrl(normalizedUrl: string): Promise<MonitorRow[]> {
  const { db } = await getDb();
  return db
    .select()
    .from(monitors)
    .where(eq(monitors.normalizedUrl, normalizedUrl))
    .orderBy(desc(monitors.createdAt));
}
