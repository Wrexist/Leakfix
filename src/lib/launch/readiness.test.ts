import { describe, expect, it } from "vitest";

import { isLaunchReady, readinessChecks } from "./readiness";

const READY = {
  DATABASE_URL: "postgres://user:pass@host/db",
  NEXT_PUBLIC_SITE_URL: "https://leakfix.app",
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  CRON_SECRET: "secret",
  EMAIL_API_KEY: "re_x",
  EMAIL_FROM: "LeakFix <hi@leakfix.app>",
};

describe("readinessChecks", () => {
  it("is launch-ready when every required setting is present", () => {
    expect(isLaunchReady(readinessChecks(READY))).toBe(true);
  });

  it("blocks launch on a missing database, placeholder domain, or dev unlock", () => {
    expect(isLaunchReady(readinessChecks({ ...READY, DATABASE_URL: "" }))).toBe(false);
    expect(isLaunchReady(readinessChecks({ ...READY, NEXT_PUBLIC_SITE_URL: "https://leakfix.example" }))).toBe(false);
    expect(isLaunchReady(readinessChecks({ ...READY, LEAKFIX_DEV_UNLOCK: "true" }))).toBe(false);
  });

  it("never includes setting values", () => {
    const serialized = JSON.stringify(readinessChecks(READY));
    for (const value of Object.values(READY)) {
      if (value.startsWith("https://")) continue;
      expect(serialized).not.toContain(value);
    }
  });
});
