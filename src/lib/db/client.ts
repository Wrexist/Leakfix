import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { SCHEMA_SQL } from "./schema-sql";
import * as schema from "./schema";

export type Database = PgliteDatabase<typeof schema>;

export interface DbBundle {
  db: Database;
  client: PGlite;
}

const globalForDb = globalThis as unknown as { __leakfixDb?: Promise<DbBundle> };

/**
 * PGlite is an embedded, WASM build of PostgreSQL. It gives us a real
 * Postgres dialect (jsonb-free for now, but timestamptz, uuid/text, real
 * indexes) without requiring a database server in development.
 *
 * Production should point at managed PostgreSQL. The schema in `schema.ts`
 * is plain Drizzle `pg-core`, so migrating to a networked driver is a
 * driver swap, not a rewrite. See docs/architecture.md.
 */
function resolveDataDir(): string | undefined {
  const dir = process.env.DATABASE_DIR?.trim();
  if (!dir || dir === "memory" || dir === ":memory:") {
    return undefined;
  }
  return dir;
}

async function createBundle(): Promise<DbBundle> {
  const dataDir = resolveDataDir();
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.waitReady;
  await client.exec(SCHEMA_SQL);
  const db = drizzle(client, { schema });
  return { db, client };
}

export function getDb(): Promise<DbBundle> {
  if (!globalForDb.__leakfixDb) {
    globalForDb.__leakfixDb = createBundle();
  }
  return globalForDb.__leakfixDb;
}

/** Test helper: dispose the cached connection so each test file starts clean. */
export async function disposeDb(): Promise<void> {
  if (!globalForDb.__leakfixDb) return;
  const bundle = await globalForDb.__leakfixDb;
  globalForDb.__leakfixDb = undefined;
  await bundle.client.close();
}
