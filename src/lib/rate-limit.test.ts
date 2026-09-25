import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { disposeDb, getDb } from "@/lib/db/client";

import { clientIp, rateLimit, resetRateLimits, type RateLimitExecutor } from "./rate-limit";

// Test files share a worker's database, so every test uses its own keys.
function uniqueKey(label: string): string {
  return `test:${label}:${randomUUID()}`;
}

async function countRows(key: string): Promise<number> {
  const { db } = await getDb();
  const result: unknown = await db.execute(sql`SELECT count(*)::int AS n FROM rate_limits WHERE key = ${key}`);
  const rows = Array.isArray(result) ? result : (result as { rows: { n: number }[] }).rows;
  return Number((rows[0] as { n: number }).n);
}

const failing: RateLimitExecutor = () => Promise.reject(new Error("connection refused"));

afterAll(async () => {
  await disposeDb();
});

describe("rateLimit (database-backed)", () => {
  it("allows requests up to the limit and counts down remaining", async () => {
    const key = uniqueKey("allow");
    const results = [];
    for (let index = 0; index < 3; index += 1) results.push(await rateLimit(key, 3, 60_000));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true]);
    expect(results.map((result) => result.remaining)).toEqual([2, 1, 0]);
    expect(await countRows(key)).toBe(1);
  });

  it("blocks over the limit and reports a retry time within the window", async () => {
    const key = uniqueKey("block");
    await rateLimit(key, 2, 5000);
    await rateLimit(key, 2, 5000);
    const blocked = await rateLimit(key, 2, 5000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(3000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(5000);
  });

  it("starts a fresh window once the old one elapses", async () => {
    const key = uniqueKey("reset");
    expect((await rateLimit(key, 1, 150)).allowed).toBe(true);
    expect((await rateLimit(key, 1, 150)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const fresh = await rateLimit(key, 1, 150);
    expect(fresh).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
  });

  it("tracks keys independently", async () => {
    const a = uniqueKey("a");
    await rateLimit(a, 1, 60_000);
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit(uniqueKey("b"), 1, 60_000)).allowed).toBe(true);
  });

  it("counts concurrent requests atomically", async () => {
    const key = uniqueKey("concurrent");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => rateLimit(key, 4, 60_000)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(4);
  });

  it("opportunistically sweeps expired rows", async () => {
    const stale = uniqueKey("stale");
    await rateLimit(stale, 5, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await rateLimit(uniqueKey("trigger"), 5, 60_000, { random: () => 0 });
    await vi.waitFor(async () => expect(await countRows(stale)).toBe(0));
  });

  it("resetRateLimits clears the shared table", async () => {
    const key = uniqueKey("cleared");
    await rateLimit(key, 1, 60_000);
    await resetRateLimits();
    expect(await countRows(key)).toBe(0);
    expect((await rateLimit(key, 1, 60_000)).allowed).toBe(true);
  });
});

describe("rateLimit fallback when the database is down", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetRateLimits();
  });

  it("falls back to the in-memory limiter instead of blocking traffic", async () => {
    const key = uniqueKey("fallback");
    const first = await rateLimit(key, 2, 60_000, { execute: failing });
    const second = await rateLimit(key, 2, 60_000, { execute: failing });
    const third = await rateLimit(key, 2, 60_000, { execute: failing });
    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("logs a structured warning only once", async () => {
    await rateLimit(uniqueKey("warn"), 5, 60_000, { execute: failing });
    await rateLimit(uniqueKey("warn"), 5, 60_000, { execute: failing });
    expect(console.warn).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({ level: "warn", event: "rate_limit_db_unavailable", error: "connection refused" });
  });

  it("resets the in-memory window after it elapses", async () => {
    const key = uniqueKey("fallback-window");
    await rateLimit(key, 1, 100, { execute: failing });
    expect((await rateLimit(key, 1, 100, { execute: failing })).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await rateLimit(key, 1, 100, { execute: failing })).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  function request(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  it("prefers x-real-ip", () => {
    expect(clientIp(request({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back to the first x-forwarded-for entry", () => {
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("returns unknown without proxy headers", () => {
    expect(clientIp(request({}))).toBe("unknown");
  });
});
