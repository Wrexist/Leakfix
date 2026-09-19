import { describe, expect, it } from "vitest";

import { isDigestDue } from "./digest-policy";

describe("isDigestDue", () => {
  const now = new Date("2026-09-19T12:00:00Z");

  it("is never due when off", () => {
    expect(isDigestDue("off", null, now)).toBe(false);
  });

  it("is due when never sent", () => {
    expect(isDigestDue("weekly", null, now)).toBe(true);
  });

  it("respects the daily window", () => {
    const sentRecently = new Date(now.getTime() - 60 * 60 * 1000);
    const sentYesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(isDigestDue("daily", sentRecently, now)).toBe(false);
    expect(isDigestDue("daily", sentYesterday, now)).toBe(true);
  });

  it("respects the weekly window", () => {
    const sentThreeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sentEightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(isDigestDue("weekly", sentThreeDaysAgo, now)).toBe(false);
    expect(isDigestDue("weekly", sentEightDaysAgo, now)).toBe(true);
  });
});
