import { logEvent } from "@/lib/logger";

import { APP_CHECKS, runAppAudit } from "./app/checks";
import { collectAndroidApp, collectIosApp } from "./app/collect";
import type { AppSnapshot } from "./app/types";
import { AUDIT_CHECKS } from "./checks";
import { extractPage, type RobotsTxtInfo } from "./extract";
import { safeFetch } from "./fetcher";
import { runAudit, summarizeChecks } from "./engine";
import { buildAppInsights } from "./insights/app";
import { buildWebsiteInsights } from "./insights/seo";
import { notifyMonitorChange } from "./notifications";
import { scoreFindings } from "./score";
import { userFacingScanError, type ScanErrorCode } from "./errors";
import * as repository from "./repository";
import { assertTransition, isScanStatus, type ScanStatus } from "./state";
import { detectScanKind, parseAppTarget } from "./target";
import { isScanKind, type ScanKind, type ScanSubject } from "./types";
import { validateUrlInput } from "./url";

export interface CreateScanSuccess {
  ok: true;
  id: string;
  status: ScanStatus;
  kind: ScanKind;
}

export interface CreateScanFailure {
  ok: false;
  code: ScanErrorCode;
  message: string;
}

export type CreateScanResult = CreateScanSuccess | CreateScanFailure;

type LogFn = (
  event: string,
  data?: Record<string, unknown>,
  level?: "info" | "warn" | "error",
) => void;

export function allowPrivateTargets(): boolean {
  return process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS === "true";
}

function mapValidationErrorToScanCode(code: string): ScanErrorCode {
  if (code === "BLOCKED_HOST" || code === "UNSUPPORTED_PORT" || code === "INVALID_HOST") {
    return "BLOCKED_TARGET";
  }
  return "INVALID_URL";
}

/** Validates input and persists a queued scan. Does not perform the scan. */
export async function createScan(rawUrl: string): Promise<CreateScanResult> {
  const validation = validateUrlInput(rawUrl, { allowPrivate: allowPrivateTargets() });
  if (!validation.ok) {
    return {
      ok: false,
      code: mapValidationErrorToScanCode(validation.code),
      message: validation.message,
    };
  }

  const kind = detectScanKind(rawUrl);

  const row = await repository.insertScan({
    submittedUrl: rawUrl.trim(),
    normalizedUrl: validation.target.href,
    kind,
  });

  return { ok: true, id: row.id, status: "queued", kind };
}

async function fetchRobotsTxt(finalUrl: string, allowPrivate: boolean): Promise<RobotsTxtInfo> {
  const empty: RobotsTxtInfo = {
    fetched: false,
    status: null,
    hasSitemap: false,
    disallowAll: false,
  };
  let robotsUrl: string;
  try {
    robotsUrl = new URL("/robots.txt", finalUrl).href;
  } catch {
    return empty;
  }

  const outcome = await safeFetch(robotsUrl, {
    allowPrivate,
    allowNonHtml: true,
    timeoutMs: 6000,
    maxBytes: 200_000,
  });

  if (outcome.ok) {
    return {
      fetched: true,
      status: outcome.statusCode,
      hasSitemap: /^\s*sitemap:/im.test(outcome.html),
      disallowAll: /^\s*disallow:\s*\/\s*$/im.test(outcome.html),
    };
  }
  if (outcome.code === "HTTP_ERROR") {
    return { fetched: true, status: outcome.statusCode ?? null, hasSitemap: false, disallowAll: false };
  }
  return empty;
}

function websiteSubject(snapshot: {
  finalUrl: string;
  title: string | null;
  favicon: string | null;
}): ScanSubject {
  return {
    kind: "website",
    name: snapshot.title,
    icon: snapshot.favicon,
    developer: null,
    storeUrl: snapshot.finalUrl,
    rating: null,
    ratingCount: null,
    installs: null,
  };
}

function appSubject(app: AppSnapshot): ScanSubject {
  return {
    kind: app.kind,
    name: app.name,
    icon: app.icon,
    developer: app.developer,
    storeUrl: app.storeUrl,
    rating: app.rating,
    ratingCount: app.ratingCount,
    installs: app.installs,
  };
}

async function failScan(
  scanId: string,
  code: ScanErrorCode,
  elapsed: () => number,
  log: LogFn,
  detail?: string,
): Promise<"failed"> {
  log("scan_acquisition_failed", { code, detail, durationMs: elapsed() }, "warn");
  await repository.updateScan(scanId, {
    status: "failed",
    errorCode: code,
    errorMessage: userFacingScanError(code).message,
    durationMs: elapsed(),
    completedAt: new Date(),
  });
  log("scan_failed", { code, durationMs: elapsed() }, "warn");
  return "failed";
}

async function analyzeWebsite(
  scan: { normalizedUrl: string },
  scanId: string,
  elapsed: () => number,
  log: LogFn,
): Promise<"completed" | "failed"> {
  const outcome = await safeFetch(scan.normalizedUrl, { allowPrivate: allowPrivateTargets() });

  if (!outcome.ok) {
    return failScan(scanId, outcome.code, elapsed, log, outcome.detail);
  }

  log("scan_acquisition_succeeded", {
    statusCode: outcome.statusCode,
    redirects: outcome.redirectChain.length,
    bytes: outcome.html.length,
    durationMs: elapsed(),
  });

  assertTransition("fetching", "analyzing");
  await repository.updateScan(scanId, { status: "analyzing", finalUrl: outcome.finalUrl });

  const snapshot = extractPage(
    outcome.html,
    outcome.finalUrl,
    outcome.statusCode,
    outcome.headers,
  );
  snapshot.robotsTxt = await fetchRobotsTxt(outcome.finalUrl, allowPrivateTargets());

  const auditFindings = runAudit(snapshot);
  const auditSummary = summarizeChecks(AUDIT_CHECKS, auditFindings);
  const insights = buildWebsiteInsights(snapshot);
  const { score } = scoreFindings(auditFindings);

  await repository.insertFindings(scanId, auditFindings);
  await repository.updateScan(scanId, {
    status: "completed",
    score,
    auditSummary,
    insights,
    subject: websiteSubject(snapshot),
    durationMs: elapsed(),
    completedAt: new Date(),
  });

  log("scan_completed", {
    kind: "website",
    score,
    findingCount: auditFindings.length,
    checksPassed: auditSummary.passed,
    checksTotal: auditSummary.total,
    durationMs: elapsed(),
  });

  await notifyMonitorChange(scanId);
  return "completed";
}

async function analyzeApp(
  scan: { normalizedUrl: string; submittedUrl: string },
  kind: ScanKind,
  scanId: string,
  elapsed: () => number,
  log: LogFn,
): Promise<"completed" | "failed"> {
  const target = parseAppTarget(scan.normalizedUrl) ?? parseAppTarget(scan.submittedUrl);
  if (!target) {
    return failScan(scanId, "INVALID_URL", elapsed, log, "app_target_unparsed");
  }

  const allowPrivate = allowPrivateTargets();
  const result =
    kind === "ios-app"
      ? await collectIosApp(target.appId, { allowPrivate })
      : await collectAndroidApp(target.storeUrl, { allowPrivate });

  if (!result.ok) {
    return failScan(scanId, result.code, elapsed, log, result.detail);
  }

  const app = result.app;
  log("scan_acquisition_succeeded", {
    kind,
    appId: app.appId,
    rating: app.rating,
    ratingCount: app.ratingCount,
    screenshots: app.screenshotCount,
    durationMs: elapsed(),
  });

  assertTransition("fetching", "analyzing");
  await repository.updateScan(scanId, { status: "analyzing", finalUrl: app.storeUrl });

  const findings = runAppAudit(app);
  const auditSummary = summarizeChecks(APP_CHECKS, findings);
  const insights = buildAppInsights(app);
  const { score } = scoreFindings(findings);

  await repository.insertFindings(scanId, findings);
  await repository.updateScan(scanId, {
    status: "completed",
    score,
    auditSummary,
    insights,
    subject: appSubject(app),
    finalUrl: app.storeUrl,
    durationMs: elapsed(),
    completedAt: new Date(),
  });

  log("scan_completed", {
    kind,
    score,
    findingCount: findings.length,
    checksPassed: auditSummary.passed,
    checksTotal: auditSummary.total,
    durationMs: elapsed(),
  });

  await notifyMonitorChange(scanId);
  return "completed";
}

/**
 * Executes the scan pipeline for an existing queued row. Branches between a
 * website page audit and an app-store listing audit.
 *
 * This function never throws; failures are persisted on the scan row and logged
 * so a background call is always safe.
 */
export async function runScan(scanId: string): Promise<void> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const log: LogFn = (event, data = {}, level = "info") =>
    logEvent(event, { scanId, ...data }, level);

  log("scan_started");

  try {
    const scan = await repository.getScanById(scanId);
    if (!scan) {
      log("scan_not_found", {}, "error");
      return;
    }

    const currentStatus: ScanStatus = isScanStatus(scan.status) ? scan.status : "queued";
    const kind: ScanKind = isScanKind(scan.kind) ? scan.kind : "website";

    assertTransition(currentStatus, "fetching");
    await repository.updateScan(scanId, { status: "fetching", startedAt: new Date() });

    if (kind === "website") {
      await analyzeWebsite(scan, scanId, elapsed, log);
    } else {
      await analyzeApp(scan, kind, scanId, elapsed, log);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("scan_analysis_failed", { error: message }, "error");
    try {
      await repository.updateScan(scanId, {
        status: "failed",
        errorCode: "INTERNAL_ERROR",
        errorMessage: userFacingScanError("INTERNAL_ERROR").message,
        durationMs: elapsed(),
        completedAt: new Date(),
      });
    } catch {
      // Persistence itself failed; the log above is the record of what happened.
    }
    log("scan_failed", { code: "INTERNAL_ERROR", durationMs: elapsed() }, "error");
  }
}

/** A scan that hasn't progressed for this long is treated as abandoned. */
export const STALE_SCAN_MS = 3 * 60 * 1000;

/**
 * Fails a scan stuck in a non-terminal state (for example when a serverless
 * function was stopped mid-scan), so the page stops polling forever and the
 * visitor can retry. Returns true when the scan was marked failed.
 */
export async function failIfStale(
  scan: { id: string; status: string; updatedAt: Date },
  now: Date = new Date(),
): Promise<boolean> {
  const status: ScanStatus = isScanStatus(scan.status) ? scan.status : "queued";
  if (status === "completed" || status === "failed") return false;
  if (now.getTime() - scan.updatedAt.getTime() < STALE_SCAN_MS) return false;

  await repository.updateScan(scan.id, {
    status: "failed",
    errorCode: "TIMEOUT",
    errorMessage: userFacingScanError("TIMEOUT").message,
    completedAt: now,
  });
  logEvent("scan_marked_stale", { scanId: scan.id, from: status }, "warn");
  return true;
}
