import type { MonitorRow } from "@/lib/db/schema";

import { compareScans, type ComparedFinding } from "./compare";
import {
  DIGEST_INTERVAL_MS,
  isDigestDue,
  isDigestFrequency,
  type DigestFrequency,
} from "./digest-policy";
import { emailConfigured, sendEmail, type EmailOutcome } from "./email";
import { monitorLabel } from "./monitors";
import {
  getFindingsForScan,
  getScansForUrl,
  insertNotification,
  listMonitors,
  updateMonitor,
} from "./repository";

export interface DigestScan {
  id: string;
  score: number | null;
  createdAt: Date;
}

export interface DigestPlan {
  subject: string;
  text: string;
  html: string;
  scansCount: number;
  firstScore: number | null;
  lastScore: number | null;
  delta: number | null;
  added: ComparedFinding[];
  fixed: ComparedFinding[];
  reportUrl: string;
  compareUrl: string | null;
}

function siteBaseUrl(override?: string): string {
  return (override ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://leakfix.example").replace(
    /\/$/,
    "",
  );
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function issueList(findings: ComparedFinding[], limit = 5): string {
  if (findings.length === 0) return "None";
  return findings
    .slice(0, limit)
    .map((finding) => `• [${finding.severity}] ${finding.title}`)
    .join("\n");
}

/** Pure: builds the digest content from a window of scans. */
export function planDigest(input: {
  label: string;
  url: string;
  frequency: DigestFrequency;
  windowLabel: string;
  scans: DigestScan[];
  added: ComparedFinding[];
  fixed: ComparedFinding[];
  baseUrl?: string;
}): DigestPlan | null {
  if (input.scans.length === 0) return null;

  const base = siteBaseUrl(input.baseUrl);
  const first = input.scans[0];
  const last = input.scans[input.scans.length - 1];
  const delta =
    input.scans.length >= 2 && first.score != null && last.score != null
      ? last.score - first.score
      : null;
  const reportUrl = `${base}/scan/${last.id}`;
  const compareUrl =
    input.scans.length >= 2 ? `${base}/compare?a=${first.id}&b=${last.id}` : null;
  const period = input.frequency === "daily" ? "Daily" : input.frequency === "weekly" ? "Weekly" : "";

  const subject = `LeakFix ${period} digest — ${input.label}`.replace(/\s+/g, " ").trim();

  const lines: string[] = [
    `LeakFix ${period.toLowerCase()} digest — ${input.label}`.replace(/\s+/g, " "),
    input.url,
    input.windowLabel,
    "",
    delta == null
      ? `Score: ${last.score ?? "—"}/100`
      : `Score: ${first.score} → ${last.score} (${formatDelta(delta)})`,
    `Scans in period: ${input.scans.length}`,
    `New issues: ${input.added.length}`,
    `Fixed: ${input.fixed.length}`,
  ];

  if (input.added.length > 0) {
    lines.push("", "New issues:", issueList(input.added));
  }
  if (input.fixed.length > 0) {
    lines.push("", "Fixed:", issueList(input.fixed));
  }
  lines.push("", `Report: ${reportUrl}`);
  if (compareUrl) lines.push(`Compare: ${compareUrl}`);

  const text = lines.join("\n");
  const html = [
    `<p><strong>LeakFix ${period.toLowerCase()} digest — ${input.label}</strong></p>`,
    `<p>${input.url}<br>${input.windowLabel}</p>`,
    delta == null
      ? `<p>Score: <strong>${last.score ?? "—"}/100</strong></p>`
      : `<p>Score: <strong>${first.score} → ${last.score}</strong> (${formatDelta(delta)})</p>`,
    `<p>Scans in period: ${input.scans.length} · New issues: ${input.added.length} · Fixed: ${input.fixed.length}</p>`,
    input.added.length > 0 ? `<h4>New issues</h4><ul>${input.added
      .slice(0, 5)
      .map((finding) => `<li>[${finding.severity}] ${finding.title}</li>`)
      .join("")}</ul>` : "",
    input.fixed.length > 0 ? `<h4>Fixed</h4><ul>${input.fixed
      .slice(0, 5)
      .map((finding) => `<li>${finding.title}</li>`)
      .join("")}</ul>` : "",
    `<p><a href="${reportUrl}">View report</a>${
      compareUrl ? ` · <a href="${compareUrl}">Compare</a>` : ""
    }</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    text,
    html,
    scansCount: input.scans.length,
    firstScore: first.score,
    lastScore: last.score,
    delta,
    added: input.added,
    fixed: input.fixed,
    reportUrl,
    compareUrl,
  };
}

function windowStart(monitor: MonitorRow, now: Date): Date {
  if (monitor.lastDigestAt) return monitor.lastDigestAt;
  const frequency = isDigestFrequency(monitor.digestFrequency) ? monitor.digestFrequency : "off";
  if (frequency !== "off") return new Date(now.getTime() - DIGEST_INTERVAL_MS[frequency]);
  return new Date(now.getTime() - DIGEST_INTERVAL_MS.weekly);
}

export interface DigestDeps {
  deliverEmail?: typeof sendEmail;
  baseUrl?: string;
  now?: Date;
}

export interface DigestDelivery {
  channel: "digest";
  target: string;
  status: "sent" | "failed" | "skipped";
  detail: string;
}

/**
 * Builds and sends the digest email for one monitor. Used by both the scheduled
 * endpoint and the manual "Send digest" action.
 */
export async function sendDigestForMonitor(
  monitor: MonitorRow,
  deps: DigestDeps = {},
): Promise<DigestDelivery[]> {
  if (!monitor.notifyEmail) return [];

  const now = deps.now ?? new Date();
  const start = windowStart(monitor, now);
  const history = (await getScansForUrl(monitor.normalizedUrl, 30))
    .slice()
    .reverse()
    .filter((scan) => scan.createdAt.getTime() >= start.getTime());

  if (history.length === 0) return [];

  const first = history[0];
  const last = history[history.length - 1];
  const [firstFindings, lastFindings] = await Promise.all([
    getFindingsForScan(first.id),
    last.id === first.id ? Promise.resolve([]) : getFindingsForScan(last.id),
  ]);
  const diff = compareScans(
    { findings: firstFindings, score: first.score },
    { findings: lastFindings, score: last.score },
  );

  const frequency = isDigestFrequency(monitor.digestFrequency) ? monitor.digestFrequency : "weekly";
  const plan = planDigest({
    label: monitorLabel(monitor),
    url: monitor.normalizedUrl,
    frequency: frequency === "off" ? "weekly" : frequency,
    windowLabel: `Since ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    scans: history.map((scan) => ({ id: scan.id, score: scan.score, createdAt: scan.createdAt })),
    added: diff.added,
    fixed: diff.fixed,
    baseUrl: deps.baseUrl,
  });
  if (!plan) return [];

  const send = deps.deliverEmail ?? sendEmail;
  const outcome: EmailOutcome = await send({
    to: monitor.notifyEmail,
    subject: plan.subject,
    text: plan.text,
    html: plan.html,
  });

  const delivery: DigestDelivery = {
    channel: "digest",
    target: monitor.notifyEmail,
    status: outcome.ok ? "sent" : outcome.detail === "email_not_configured" ? "skipped" : "failed",
    detail: outcome.detail,
  };

  await insertNotification({
    monitorId: monitor.id,
    scanId: last.id,
    channel: "digest",
    target: delivery.target,
    status: delivery.status,
    detail: delivery.detail,
  });

  if (outcome.ok) {
    await updateMonitor(monitor.id, { lastDigestAt: now });
  }

  return [delivery];
}

export interface DigestRunSummary {
  checked: number;
  sent: number;
  skipped: number;
  results: { id: string; url: string; status: string; detail?: string }[];
}

/** Sends digests for every monitor that is due. */
export async function runDigests(deps: DigestDeps = {}): Promise<DigestRunSummary> {
  const now = deps.now ?? new Date();
  const monitors = await listMonitors();
  const summary: DigestRunSummary = { checked: 0, sent: 0, skipped: 0, results: [] };

  if (!emailConfigured() && !deps.deliverEmail) {
    return summary;
  }

  for (const monitor of monitors) {
    const frequency = isDigestFrequency(monitor.digestFrequency) ? monitor.digestFrequency : "off";
    if (!monitor.active || frequency === "off" || !monitor.notifyEmail) continue;
    if (!isDigestDue(frequency, monitor.lastDigestAt, now)) continue;

    summary.checked += 1;
    const deliveries = await sendDigestForMonitor(monitor, { ...deps, now });
    const delivery = deliveries[0];
    if (delivery?.status === "sent") summary.sent += 1;
    else summary.skipped += 1;
    summary.results.push({
      id: monitor.id,
      url: monitor.normalizedUrl,
      status: delivery?.status ?? "skipped",
      detail: delivery?.detail,
    });
  }

  return summary;
}
