import { describe, expect, it } from "vitest";

import { extractPage } from "../extract";
import { extraChecks } from "./extras";

function run(id: string, html: string, headers: Record<string, string> = {}) {
  const check = extraChecks.find((entry) => entry.id === id);
  if (!check) throw new Error(`missing check ${id}`);
  const snapshot = extractPage(html, "https://acme.test/", 200, headers);
  return check.run({ snapshot }).map((finding) => finding.ruleId);
}

describe("extra checks", () => {
  it("accepts a correct viewport and flags a misconfigured one", () => {
    const good = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>`;
    const bad = `<html><head><meta name="viewport" content="width=1024"></head><body></body></html>`;
    expect(run("mobile.viewport-config", good)).toHaveLength(0);
    expect(run("mobile.viewport-config", bad)).toContain("mobile.viewport-config");
  });

  it("flags multiple title elements", () => {
    const html = `<html><head><title>One</title><title>Two</title></head><body></body></html>`;
    expect(run("seo.title-count", html)).toContain("seo.title-count");
  });

  it("flags focusable content inside aria-hidden containers", () => {
    const html = `<html><body><div aria-hidden="true"><button>Hidden</button></div></body></html>`;
    expect(run("accessibility.aria-hidden-focusable", html)).toContain(
      "accessibility.aria-hidden-focusable",
    );
  });

  it("flags unsafe-eval in the CSP", () => {
    const baseline = { "content-security-policy": "default-src 'self'; script-src 'self'" };
    const weak = {
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-eval'",
    };
    expect(run("security.csp-unsafe-eval", "<html></html>", baseline)).toHaveLength(0);
    expect(run("security.csp-unsafe-eval", "<html></html>", weak)).toContain(
      "security.csp-unsafe-eval",
    );
  });

  it("flags cross-origin resources without integrity", () => {
    const withoutIntegrity = `<html><head><script src="https://cdn.other.com/lib.js"></script></head><body></body></html>`;
    const withIntegrity = `<html><head><script src="https://cdn.other.com/lib.js" integrity="sha384-x"></script></head><body></body></html>`;
    const sameOrigin = `<html><head><script src="/app.js"></script></head><body></body></html>`;
    expect(run("security.sri", withoutIntegrity)).toContain("security.sri-missing");
    expect(run("security.sri", withIntegrity)).toHaveLength(0);
    expect(run("security.sri", sameOrigin)).toHaveLength(0);
  });
});
