import { afterEach, describe, expect, it } from "vitest";

import { isCronAuthorized, safeEqual } from "./auth";

const originalSecret = process.env.CRON_SECRET;

function request(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/digest", { method: "POST", headers });
}

describe("safeEqual", () => {
  it("matches identical strings only", () => {
    expect(safeEqual("s3cret", "s3cret")).toBe(true);
    expect(safeEqual("s3cret", "s3creT")).toBe(false);
  });

  it("handles different lengths without throwing", () => {
    expect(safeEqual("s3cret-but-longer", "s3cret")).toBe(false);
    expect(safeEqual("s", "s3cret")).toBe(false);
  });

  it("never matches empty values", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });
});

describe("isCronAuthorized", () => {
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("rejects everything when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(request({ authorization: "Bearer " }))).toBe(false);
  });

  it("accepts the bearer header or x-cron-secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isCronAuthorized(request({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(isCronAuthorized(request({ "x-cron-secret": "s3cret" }))).toBe(true);
    expect(isCronAuthorized(request({ authorization: "Bearer s3cre" }))).toBe(false);
    expect(isCronAuthorized(request({ "x-cron-secret": "s3cret-extra" }))).toBe(false);
  });
});
