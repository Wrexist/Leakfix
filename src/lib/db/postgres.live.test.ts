import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { disposeDb, ensurePostgresSchema, getDb } from "./client";
import { entitlements, monitors, scans } from "./schema";

/**
 * Opt-in check of the postgres-js driver against a real server. Skipped unless
 * LEAKFIX_TEST_DATABASE_URL points at a DISPOSABLE database: the public schema
 * is dropped and recreated.
 */
const url = process.env.LEAKFIX_TEST_DATABASE_URL;

describe.skipIf(!url)("postgres driver (live)", () => {
  const previousUrl = process.env.DATABASE_URL;

  afterAll(async () => {
    await disposeDb();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it("bootstraps the schema safely from concurrent cold starts", async () => {
    const admin = postgres(url!, { max: 1, onnotice: () => undefined });
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;").simple();
    await admin.end();

    const clients = Array.from({ length: 4 }, () =>
      postgres(url!, { max: 1, prepare: false, onnotice: () => undefined }),
    );
    try {
      await Promise.all(clients.map((client) => ensurePostgresSchema(client)));
      // Re-running on an existing schema is a no-op.
      await ensurePostgresSchema(clients[0]);
      const versions = await clients[0]`SELECT version FROM leakfix_schema_version`;
      expect(versions).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("serves queries through getDb() when DATABASE_URL is set", async () => {
    await disposeDb();
    process.env.DATABASE_URL = url;
    const { db, driver } = await getDb();
    expect(driver).toBe("postgres");

    await db.insert(scans).values({
      id: "live-scan",
      submittedUrl: "https://example.com",
      normalizedUrl: "https://example.com/",
    });
    await db.insert(entitlements).values({
      id: "live-ent",
      scanId: "live-scan",
      normalizedUrl: "https://example.com/",
    });

    const rows = await db.select().from(entitlements).where(eq(entitlements.scanId, "live-scan"));
    expect(rows).toHaveLength(1);
    expect(rows[0].createdAt).toBeInstanceOf(Date);

    // jsonb must be stored as JSON, not as a double-encoded string.
    await db.insert(monitors).values({
      id: "live-monitor",
      normalizedUrl: "https://example.com/",
      digestRecipients: ["a@example.com"],
    });
    const [monitor] = await db.select().from(monitors).where(eq(monitors.id, "live-monitor"));
    expect(monitor.digestRecipients).toEqual(["a@example.com"]);
    const [shape] = await db
      .select({ type: sql<string>`jsonb_typeof(${monitors.digestRecipients})` })
      .from(monitors)
      .where(eq(monitors.id, "live-monitor"));
    expect(shape.type).toBe("array");
  });
});
