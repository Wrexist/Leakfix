import { describe, expect, it } from "vitest";

import { normalizeUrlInput, validateUrlInput, validateUrlSyntax } from "./url";

describe("normalizeUrlInput", () => {
  it("adds https to bare domains", () => {
    expect(normalizeUrlInput("example.com")).toBe("https://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrlInput("  example.com  ")).toBe("https://example.com");
  });

  it("keeps an explicit scheme", () => {
    expect(normalizeUrlInput("http://example.com")).toBe("http://example.com");
  });

  it("returns empty for empty input", () => {
    expect(normalizeUrlInput("   ")).toBe("");
  });
});

describe("validateUrlInput", () => {
  it("accepts a bare domain and normalizes it", () => {
    const result = validateUrlInput("example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.href).toBe("https://example.com/");
      expect(result.target.hostname).toBe("example.com");
    }
  });

  it("accepts a full https URL with a path", () => {
    const result = validateUrlInput("https://shop.example.com/products/widget");
    expect(result.ok).toBe(true);
  });

  it("rejects empty input", () => {
    const result = validateUrlInput("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("REQUIRED");
  });

  it("rejects malformed input", () => {
    const result = validateUrlInput("not a url");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MALFORMED");
  });

  it("rejects non-http schemes", () => {
    const result = validateUrlInput("ftp://example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNSUPPORTED_SCHEME");
  });

  it("rejects credentials in the URL", () => {
    const result = validateUrlInput("https://user:pass@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CREDENTIALS_NOT_ALLOWED");
  });

  it("rejects non-standard ports", () => {
    const result = validateUrlInput("https://example.com:8443");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNSUPPORTED_PORT");
  });

  it.each([
    ["localhost", "BLOCKED_HOST"],
    ["http://127.0.0.1", "BLOCKED_HOST"],
    ["http://10.0.0.5", "BLOCKED_HOST"],
    ["http://172.16.4.1", "BLOCKED_HOST"],
    ["http://192.168.1.1", "BLOCKED_HOST"],
    ["http://169.254.169.254", "BLOCKED_HOST"],
    ["http://[::1]", "BLOCKED_HOST"],
    ["http://service.internal", "BLOCKED_HOST"],
  ])("blocks private or internal target %s", (input, code) => {
    const result = validateUrlInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });

  it("rejects invalid domain names", () => {
    const result = validateUrlInput("https://nodot");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_HOST");
  });

  it("allows loopback targets when allowPrivate is set (test mode only)", () => {
    const result = validateUrlInput("http://localhost:51234/fixture", { allowPrivate: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target.port).toBe("51234");
  });
});

describe("validateUrlSyntax (client-side UX only)", () => {
  it("skips the network-target policy", () => {
    expect(validateUrlSyntax("localhost").ok).toBe(true);
    expect(validateUrlSyntax("http://127.0.0.1:1234").ok).toBe(true);
    expect(validateUrlSyntax("https://example.com:8443").ok).toBe(true);
  });

  it("still enforces syntax and scheme", () => {
    expect(validateUrlSyntax("not a url").ok).toBe(false);
    expect(validateUrlSyntax("ftp://example.com").ok).toBe(false);
    expect(validateUrlSyntax("https://user:pass@example.com").ok).toBe(false);
  });
});
