import { createHash } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logEvent } from "@/lib/logger";

import { isEphemeralInProduction, selectDriver, type DriverChoice } from "./driver";
import { SCHEMA_SQL } from "./schema-sql";
import * as schema from "./schema";

/**
 * The query surface shared by both drivers. PGlite and postgres-js each return
 * a `PgDatabase` subclass; callers only use the common query builder, so they
 * compile against this base type regardless of which driver is active.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbBundle {
  db: Database;
  driver: DriverChoice["kind"];
  /** Closes the underlying connection (PGlite instance or postgres-js pool). */
  close: () => Promise<void>;
}

// Cached on globalThis so Next.js hot reloads reuse one connection per process.
const globalForDb = globalThis as unknown as {
  __leakfixDb?: Promise<DbBundle>;
  __leakfixEphemeralWarned?: boolean;
};

// Arbitrary constant key for the schema bootstrap advisory lock.
const SCHEMA_LOCK_KEY = 7_311_452_019;

// Content hash of the DDL: any edit to schema-sql.ts re-runs the bootstrap.
const SCHEMA_VERSION = createHash("sha256").update(SCHEMA_SQL).digest("hex");

async function schemaIsCurrent(sql: postgres.Sql | postgres.TransactionSql): Promise<boolean> {
  const [table] = await sql`SELECT to_regclass('leakfix_schema_version') IS NOT NULL AS present`;
  if (!table?.present) return false;
  const rows = await sql`SELECT 1 FROM leakfix_schema_version WHERE version = ${SCHEMA_VERSION}`;
  return rows.length > 0;
}

/**
 * Runs the idempotent DDL in `schema-sql.ts` against a networked database,
 * once per schema version rather than on every cold start: `ALTER TABLE` takes
 * an ACCESS EXCLUSIVE lock even when the column exists, which would stall live
 * traffic (and can deadlock with it) each time a serverless instance boots.
 *
 * The advisory lock serializes instances that boot together (parallel `CREATE
 * TABLE IF NOT EXISTS` can otherwise race on the pg_type catalog); the version
 * is re-checked under the lock so only the first one runs the DDL.
 */
export async function ensurePostgresSchema(client: postgres.Sql): Promise<void> {
  if (await schemaIsCurrent(client)) return;
  await client.begin(async (tx) => {
    await tx.unsafe(`SELECT pg_advisory_xact_lock(${SCHEMA_LOCK_KEY})`);
    if (await schemaIsCurrent(tx)) return;
    // Fail fast instead of queueing live queries behind a blocked DDL lock.
    await tx.unsafe("SET LOCAL lock_timeout = '15s'");
    await tx.unsafe(SCHEMA_SQL).simple();
    await tx.unsafe(
      "CREATE TABLE IF NOT EXISTS leakfix_schema_version " +
        "(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    await tx`INSERT INTO leakfix_schema_version (version) VALUES (${SCHEMA_VERSION}) ON CONFLICT DO NOTHING`;
  });
}

/**
 * Production should use managed PostgreSQL via `DATABASE_URL` (Neon, Supabase,
 * RDS, ...). PGlite, an embedded WASM build of PostgreSQL, remains the default
 * for development, tests, and e2e, so no database server is needed locally.
 * The schema in `schema.ts` is plain Drizzle `pg-core` and runs on both.
 */
async function createPostgresBundle(url: string): Promise<DbBundle> {
  const client = postgres(url, {
    // Serverless instances each hold their own pool; keep it small so many
    // instances do not exhaust the server's connection limit.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Transaction-mode poolers (PgBouncer, Neon, Supabase :6543) hand each
    // transaction a different backend, so named prepared statements created on
    // one connection are missing on the next. Disable them.
    prepare: false,
    // `CREATE ... IF NOT EXISTS` emits a NOTICE per existing object on boot.
    onnotice: () => undefined,
  });

  await ensurePostgresSchema(client);

  const db = drizzlePostgres(client, { schema });
  return { db, driver: "postgres", close: () => client.end({ timeout: 5 }) };
}

async function createPgliteBundle(dataDir: string | undefined): Promise<DbBundle> {
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.waitReady;
  await client.exec(SCHEMA_SQL);
  const db = drizzlePglite(client, { schema });
  return { db, driver: dataDir ? "pglite-dir" : "pglite-memory", close: () => client.close() };
}

function warnIfEphemeralInProduction(): void {
  if (globalForDb.__leakfixEphemeralWarned) return;
  if (!isEphemeralInProduction(process.env)) return;
  globalForDb.__leakfixEphemeralWarned = true;
  // Deliberately not thrown: `next build` runs with NODE_ENV=production.
  logEvent(
    "ephemeral_database_in_production",
    {
      detail:
        "No DATABASE_URL or persistent DATABASE_DIR. Data (including paid unlocks) " +
        "lives in memory, is lost on restart, and is not shared between instances.",
    },
    "error",
  );
}

async function createBundle(): Promise<DbBundle> {
  warnIfEphemeralInProduction();
  const choice = selectDriver(process.env);
  if (choice.kind === "postgres") return createPostgresBundle(choice.url);
  return createPgliteBundle(choice.kind === "pglite-dir" ? choice.dir : undefined);
}

export function getDb(): Promise<DbBundle> {
  if (!globalForDb.__leakfixDb) {
    const pending = createBundle();
    globalForDb.__leakfixDb = pending;
    // Do not cache a failed connection forever: a transient network error at
    // boot would otherwise poison this process. The next call retries.
    pending.catch(() => {
      if (globalForDb.__leakfixDb === pending) globalForDb.__leakfixDb = undefined;
    });
  }
  return globalForDb.__leakfixDb;
}

/** Test helper: dispose the cached connection so each test file starts clean. */
export async function disposeDb(): Promise<void> {
  if (!globalForDb.__leakfixDb) return;
  const bundle = await globalForDb.__leakfixDb;
  globalForDb.__leakfixDb = undefined;
  await bundle.close();
}
