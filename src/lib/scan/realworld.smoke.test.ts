import { describe, expect, it } from "vitest";

import { extractPage } from "./extract";
import { safeFetch } from "./fetcher";

/**
 * Opt-in smoke test that hits a real public website. Skipped by default so the
 * normal test run stays deterministic and offline-safe.
 *
 * Run with: `LEAKFIX_REALWORLD=1 npx vitest run src/lib/scan/realworld.smoke.test.ts`
 */
const ENABLED = process.env.LEAKFIX_REALWORLD === "1";

describe.skipIf(!ENABLED)("real-world smoke", () => {
  it("fetches and extracts a real public page", async () => {
    const outcome = await safeFetch("https://example.com");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const snapshot = extractPage(outcome.html, outcome.finalUrl, outcome.statusCode);
    expect(snapshot.title).toBeTruthy();
    expect(snapshot.h1Count).toBeGreaterThan(0);
    expect(snapshot.protocol).toBe("https:");
  }, 30_000);

  it("reports a DNS failure for a non-existent domain", async () => {
    const outcome = await safeFetch("https://this-domain-does-not-exist-leakfix-12345.com");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(["DNS_FAILURE", "UNREACHABLE", "TIMEOUT"]).toContain(outcome.code);
  }, 30_000);
});
