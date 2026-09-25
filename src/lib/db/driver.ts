/**
 * Pure database driver selection. No Node or driver imports, so the decision
 * table is covered by fast unit tests without a live database.
 *
 * - `DATABASE_URL` set          -> networked PostgreSQL (postgres-js).
 * - `DATABASE_DIR` is a path    -> PGlite persisted to that directory.
 * - otherwise (unset/"memory")  -> PGlite in memory (tests, e2e, quick dev).
 */

export type DriverChoice =
  | { kind: "postgres"; url: string }
  | { kind: "pglite-dir"; dir: string }
  | { kind: "pglite-memory" };

export type DriverEnv = Partial<Record<"DATABASE_URL" | "DATABASE_DIR" | "NODE_ENV", string>>;

const MEMORY_DIRS = new Set(["", "memory", ":memory:"]);

export function selectDriver(env: DriverEnv): DriverChoice {
  const url = env.DATABASE_URL?.trim();
  if (url) return { kind: "postgres", url };

  const dir = env.DATABASE_DIR?.trim() ?? "";
  if (!MEMORY_DIRS.has(dir)) return { kind: "pglite-dir", dir };

  return { kind: "pglite-memory" };
}

/**
 * True when a production process would keep its data only in memory. Paid
 * unlocks and monitors would vanish on restart, and every serverless instance
 * would see a different database, so this must be loud.
 */
export function isEphemeralInProduction(env: DriverEnv): boolean {
  return env.NODE_ENV === "production" && selectDriver(env).kind === "pglite-memory";
}
