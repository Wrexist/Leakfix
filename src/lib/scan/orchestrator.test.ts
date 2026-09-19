import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposeDb } from "@/lib/db/client";

import { GOOD_HEADERS, GOOD_PAGE_HTML, LEAKY_PAGE_HTML } from "./__fixtures__/pages";
import { loadScanHistory } from "./history";
import { createScan, runScan } from "./orchestrator";
import {
  createMonitor,
  deleteMonitor,
  getFindingsForScan,
  getMonitorById,
  getMonitorByUrl,
  getScanById,
  getScansForUrl,
  updateMonitor,
} from "./repository";
import { scoreFindings } from "./score";
import { toScanDto } from "./dto";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS = "true";
  delete process.env.DATABASE_DIR;

  const goodResponseHeaders: Record<string, string> = { ...GOOD_HEADERS };
  // content-encoding cannot be faked here: fetch would try to decode the body.
  delete goodResponseHeaders["content-encoding"];

  server = http.createServer((request, response) => {
    const url = request.url ?? "/";
    if (url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
      return;
    }
    if (url.startsWith("/leaky")) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(LEAKY_PAGE_HTML);
      return;
    }
    if (url === "/redirect") {
      response.writeHead(302, { location: "/good" });
      response.end();
      return;
    }
    if (url === "/json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
    if (url === "/missing") {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("<h1>Not found</h1>");
      return;
    }
    response.writeHead(200, goodResponseHeaders);
    response.end(GOOD_PAGE_HTML);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disposeDb();
  delete process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS;
});

async function runFullScan(path: string) {
  const created = await createScan(`${baseUrl}${path}`);
  if (!created.ok) throw new Error(`createScan failed: ${created.code}`);
  await runScan(created.id);
  const scan = await getScanById(created.id);
  if (!scan) throw new Error("scan row missing");
  const findings = await getFindingsForScan(created.id);
  return { scan, findings, dto: toScanDto(scan, findings) };
}

describe("scan orchestrator (end to end, local fixture server)", () => {
  it("completes a healthy page and scores it", async () => {
    const { scan, findings, dto } = await runFullScan("/good");

    expect(scan.status).toBe("completed");
    expect(scan.score).toBe(scoreFindings(dto.findings).score);

    // The fixture server is plain HTTP and cannot send real compression.
    const ids = findings.map((row) => row.ruleId);
    expect(ids).toContain("security.https");
    expect(ids).toContain("performance.compression-missing");
    expect(ids).not.toContain("seo.meta-description-missing");
    expect(ids).not.toContain("mobile.viewport-missing");
    expect(dto.severityCounts.high).toBe(1);
    expect(dto.auditSummary?.total).toBeGreaterThan(20);
    expect(dto.auditSummary?.passed).toBeGreaterThan(20);
    expect(dto.findings[0].details?.steps.length).toBeGreaterThan(0);
    expect(scan.durationMs).toBeGreaterThanOrEqual(0);
    expect(scan.startedAt).not.toBeNull();
    expect(scan.completedAt).not.toBeNull();
  });

  it("finds real problems on a leaky page", async () => {
    const { scan, findings } = await runFullScan("/leaky");

    expect(scan.status).toBe("completed");
    const ids = findings.map((row) => row.ruleId);
    expect(ids).toContain("seo.title-too-long");
    expect(ids).toContain("seo.meta-description-missing");
    expect(ids).toContain("mobile.viewport-missing");
    expect(ids).toContain("accessibility.image-alt-missing");
    expect(scan.score).toBeLessThan(85);
  });

  it("follows redirects and records the final URL", async () => {
    const { scan } = await runFullScan("/redirect");
    expect(scan.status).toBe("completed");
    expect(scan.finalUrl).toMatch(/\/good$/);
  });

  it("fails cleanly on non-HTML content", async () => {
    const { scan, dto } = await runFullScan("/json");
    expect(scan.status).toBe("failed");
    expect(scan.errorCode).toBe("UNSUPPORTED_CONTENT");
    expect(dto.errorMessage).toBeTruthy();
  });

  it("fails cleanly on an HTTP error status", async () => {
    const { scan } = await runFullScan("/missing");
    expect(scan.status).toBe("failed");
    expect(scan.errorCode).toBe("HTTP_ERROR");
  });

  it("fails cleanly on an unreachable host", async () => {
    const created = await createScan("http://127.0.0.1:1/");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await runScan(created.id);
    const scan = await getScanById(created.id);
    expect(scan?.status).toBe("failed");
    expect(["UNREACHABLE", "TIMEOUT"]).toContain(scan?.errorCode);
  });

  it("rejects blocklisted targets before creating a scan", async () => {
    const previous = process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS;
    delete process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS;
    try {
      const created = await createScan("http://10.0.0.1/");
      expect(created.ok).toBe(false);
      if (!created.ok) expect(created.code).toBe("BLOCKED_TARGET");
    } finally {
      if (previous !== undefined) process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS = previous;
    }
  });

  it("rejects invalid input before creating a scan", async () => {
    const created = await createScan("not a url");
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.code).toBe("INVALID_URL");
  });

  it("diffs findings against the previous scan of the same target", async () => {
    const first = await runFullScan("/leaky");
    const second = await runFullScan("/leaky");

    const secondRow = await getScanById(second.scan.id);
    expect(secondRow).not.toBeNull();
    const history = await loadScanHistory(secondRow!);

    expect(history.diff?.previousId).toBe(first.scan.id);
    expect(history.diff?.added).toHaveLength(0);
    expect(history.diff?.fixed).toHaveLength(0);
    expect(history.diff?.persisting.length).toBeGreaterThan(0);
    expect(history.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("tracks a monitor and its scan timeline", async () => {
    const url = `${baseUrl}/good`;
    await runFullScan("/good");

    const monitor = await createMonitor({ normalizedUrl: url, kind: "website", label: "Good" });
    expect((await getMonitorByUrl(url))?.id).toBe(monitor.id);

    const timeline = await getScansForUrl(url, 5);
    expect(timeline.length).toBeGreaterThan(0);

    await updateMonitor(monitor.id, {
      lastScanId: timeline[0].id,
      lastScore: timeline[0].score,
      lastScannedAt: new Date(),
      scanCount: timeline.length,
    });

    const updated = await getMonitorById(monitor.id);
    expect(updated?.lastScanId).toBe(timeline[0].id);
    expect(updated?.scanCount).toBe(timeline.length);

    await deleteMonitor(monitor.id);
    expect(await getMonitorById(monitor.id)).toBeNull();
  });

  it("does not throw when the scan row is missing", async () => {
    await expect(runScan("00000000-0000-0000-0000-000000000000")).resolves.toBeUndefined();
  });
});
