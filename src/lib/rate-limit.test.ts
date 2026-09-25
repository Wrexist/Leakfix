import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, clientIp, resetRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit", () => {
    for (let index = 0; index < 3; index += 1) {
      expect(checkRateLimit("ip", 3, 1000, 0).allowed).toBe(true);
    }
  });

  it("blocks requests over the limit and reports retry time", () => {
    const now = 1000;
    checkRateLimit("ip", 2, 5000, now);
    checkRateLimit("ip", 2, 5000, now);
    const blocked = checkRateLimit("ip", 2, 5000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(5000);
  });

  it("resets after the window elapses", () => {
    checkRateLimit("ip", 1, 1000, 0);
    expect(checkRateLimit("ip", 1, 1000, 500).allowed).toBe(false);
    expect(checkRateLimit("ip", 1, 1000, 1500).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    checkRateLimit("a", 1, 1000, 0);
    expect(checkRateLimit("b", 1, 1000, 0).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  function request(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  it("prefers x-real-ip", () => {
    expect(clientIp(request({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back to the first x-forwarded-for entry", () => {
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("returns unknown without proxy headers", () => {
    expect(clientIp(request({}))).toBe("unknown");
  });
});
