import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { isLaunchReady, readinessChecks } from "@/lib/launch/readiness";

import { isCronAuthorized } from "../cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uptime check. Public callers get only up/down. With the cron secret
 * (`Authorization: Bearer <CRON_SECRET>`) it also returns the launch checklist:
 * which settings are present, never their values.
 */
export async function GET(request: Request) {
  let database: "ok" | "error" = "ok";
  let driver: string | null = null;
  try {
    const bundle = await getDb();
    driver = bundle.driver;
    await bundle.db.execute(sql`select 1`);
  } catch {
    database = "error";
  }

  const ok = database === "ok";
  const body: Record<string, unknown> = { ok, database };

  if (isCronAuthorized(request)) {
    const checks = readinessChecks();
    body.driver = driver;
    body.launchReady = ok && driver === "postgres" && isLaunchReady(checks);
    body.checks = checks;
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
