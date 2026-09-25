import { describe, expect, it } from "vitest";

import { isEphemeralInProduction, selectDriver } from "./driver";

describe("selectDriver", () => {
  it("prefers DATABASE_URL over DATABASE_DIR", () => {
    expect(
      selectDriver({ DATABASE_URL: " postgres://u:p@db.example/app ", DATABASE_DIR: "./data" }),
    ).toEqual({ kind: "postgres", url: "postgres://u:p@db.example/app" });
  });

  it("uses a persisted PGlite directory when DATABASE_DIR is a path", () => {
    expect(selectDriver({ DATABASE_DIR: "./data/pglite" })).toEqual({
      kind: "pglite-dir",
      dir: "./data/pglite",
    });
  });

  it("falls back to in-memory PGlite when nothing persistent is configured", () => {
    for (const env of [
      {},
      { DATABASE_DIR: "memory" },
      { DATABASE_DIR: ":memory:" },
      { DATABASE_DIR: "  " },
      { DATABASE_URL: "", DATABASE_DIR: "memory" },
    ]) {
      expect(selectDriver(env)).toEqual({ kind: "pglite-memory" });
    }
  });
});

describe("isEphemeralInProduction", () => {
  it("flags production without a persistent database", () => {
    expect(isEphemeralInProduction({ NODE_ENV: "production" })).toBe(true);
    expect(isEphemeralInProduction({ NODE_ENV: "production", DATABASE_DIR: "memory" })).toBe(true);
  });

  it("accepts production with DATABASE_URL or a persistent directory", () => {
    expect(
      isEphemeralInProduction({ NODE_ENV: "production", DATABASE_URL: "postgres://db/app" }),
    ).toBe(false);
    expect(isEphemeralInProduction({ NODE_ENV: "production", DATABASE_DIR: "/var/lib/leakfix" })).toBe(
      false,
    );
  });

  it("never flags development or test", () => {
    expect(isEphemeralInProduction({ NODE_ENV: "development" })).toBe(false);
    expect(isEphemeralInProduction({ NODE_ENV: "test", DATABASE_DIR: "memory" })).toBe(false);
  });
});
