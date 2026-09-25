import { sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { logEvent } from "@/lib/logger";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** Share of calls that also sweep expired rows out of `rate_limits`. */
const CLEANUP_PROBABILITY = 0.01;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Runs one SQL statement and returns its rows. Injected so tests can simulate
 * a database outage without touching the shared connection.
 */
export type RateLimitExecutor = (query: SQL) => Promise<Record<string, unknown>[]>;

export interface RateLimitDeps {
  execute?: RateLimitExecutor;
  /** Source of randomness for the opportunistic cleanup (defaults to Math.random). */
  random?: () => number;
}

let fallbackWarned = false;

/**
 * postgres-js returns the rows array itself; PGlite wraps them in `{ rows }`.
 */
async function executeOnDb(query: SQL): Promise<Record<string, unknown>[]> {
  const { db } = await getDb();
  const result: unknown = await db.execute(query);
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
}

/**
 * Atomic fixed-window increment. The whole read-modify-write is one statement,
 * so concurrent requests on different instances serialize on the row lock and
 * each sees a distinct count. Timestamps come from the database clock only, so
 * skew between serverless instances does not stretch or shrink windows.
 */
function incrementQuery(key: string, windowMs: number): SQL {
  const window = sql`(${windowMs}::double precision * interval '1 millisecond')`;
  const expired = sql`rate_limits.window_start <= now() - ${window}`;
  return sql`
    INSERT INTO rate_limits (key, count, window_start, expires_at)
    VALUES (${key}, 1, now(), now() + ${window})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN ${expired} THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN ${expired} THEN now() ELSE rate_limits.window_start END,
      expires_at = CASE WHEN ${expired} THEN now() + ${window} ELSE rate_limits.expires_at END
    RETURNING
      count,
      window_start,
      greatest(0, ceil(extract(epoch FROM (expires_at - now())) * 1000))::double precision AS retry_after_ms
  `;
}

function sweepExpired(execute: RateLimitExecutor): void {
  // Fire-and-forget: cleanup must never slow down or fail the request.
  execute(sql`DELETE FROM rate_limits WHERE expires_at < now()`).catch(() => undefined);
}

/**
 * Shared fixed-window rate limiter backed by the `rate_limits` table, so every
 * serverless instance counts against the same budget. If the database is
 * unreachable it degrades to the per-instance in-memory limiter rather than
 * blocking traffic.
 */
export async function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
  deps: RateLimitDeps = {},
): Promise<RateLimitResult> {
  const execute = deps.execute ?? executeOnDb;
  try {
    const rows = await execute(incrementQuery(key, windowMs));
    const row = rows[0];
    if (!row) throw new Error("rate limit upsert returned no row");
    const count = Number(row.count);
    if ((deps.random ?? Math.random)() < CLEANUP_PROBABILITY) sweepExpired(execute);
    if (count <= limit) return { allowed: true, remaining: limit - count, retryAfterMs: 0 };
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(1, Math.min(windowMs, Number(row.retry_after_ms))),
    };
  } catch (error) {
    if (!fallbackWarned) {
      fallbackWarned = true;
      logEvent(
        "rate_limit_db_unavailable",
        {
          detail: "Falling back to per-instance in-memory rate limiting.",
          error: error instanceof Error ? error.message : String(error),
        },
        "warn",
      );
    }
    return checkRateLimit(key, limit, windowMs);
  }
}

/**
 * In-memory fixed-window limiter. Only protects a single instance, so it is
 * used solely as the fallback when the shared database store is unavailable.
 */
function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(bucketKey);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** Test helper: clears the in-memory fallback and the shared table. */
export async function resetRateLimits(): Promise<void> {
  buckets.clear();
  fallbackWarned = false;
  try {
    await executeOnDb(sql`DELETE FROM rate_limits`);
  } catch {
    // No database: the in-memory state above is all there is to clear.
  }
}

/**
 * Best-effort client IP for rate-limit keys. Prefers `x-real-ip`, then the
 * first `x-forwarded-for` entry. Both are client-controlled unless the reverse
 * proxy in front of the app overwrites them — make sure it does, or these keys
 * can be spoofed to dodge per-IP limits.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
