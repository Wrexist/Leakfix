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
  ensureWebhookSecret,
  getFindingsForScan,
  getScansForUrl,
  insertNotification,
  listMonitors,
  updateMonitor,
} from "./repository";
import { sendWebhookWithRetry } from "./webhook";

export interface DigestScan {
  id: string;
  score: number | null;
  createdAt: Date;
}

export interface DigestPlan {
  subject: string;
  text: string;
  html: string;
  chartHtml: string;
  sparkline: string;
  scansCount: number;
  firstScore: number | null;
  lastScore: number | null;
  delta: number | null;
  added: ComparedFinding[];
  fixed: ComparedFinding[];
  reportUrl: string;
  compareUrl: string | null;
}

const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** Plain-text sparkline of the scores (for text-only email clients). */
export function sparkline(scores: (number | null)[]): string {
  const values = scores.filter((score): score is number => score != null);
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return scores
    .map((score) =>
      score == null ? " " : SPARK_CHARS[Math.min(7, Math.round(((score - min) / span) * 7))],
    )
    .join("");
}

function scoreColor(score: number): string {
  if (score >= 80) return "#0f7a56";
  if (score >= 60) return "#b45309";
  return "#c0272d";
}

/** Email-safe bar chart (table + inline styles) of the recent scores. */
export function scoreBarsHtml(scores: (number | null)[], maxPoints = 14): string {
  const points = scores.filter((score): score is number => score != null).slice(-maxPoints);
  if (points.length < 2) return "";
  const bars = points
    .map((score) => {
      const height = Math.max(6, Math.round((Math.max(0, Math.min(100, score)) / 100) * 48));
      return `<td valign="bottom" style="padding:0 3px;"><div style="width:14px;height:${height}px;background:${scoreColor(
        score,
      )};border-radius:3px 3px 0 0;"></div></td>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="height:52px;margin:8px 0"><tr>${bars}</tr></table>`;
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

  const scores = input.scans.map((scan) => scan.score);
  const chartHtml = scoreBarsHtml(scores);
  const spark = sparkline(scores);
  if (spark) {
    lines.push("", `Score trend: ${spark}`);
  }

  const text = lines.join("\n");
  const html = [
    `<p><strong>LeakFix ${period.toLowerCase()} digest — ${input.label}</strong></p>`,
    `<p>${input.url}<br>${input.windowLabel}</p>`,
    delta == null
      ? `<p>Score: <strong>${last.score ?? "—"}/100</strong></p>`
      : `<p>Score: <strong>${first.score} → ${last.score}</strong> (${formatDelta(delta)})</p>`,
    chartHtml ? `<p style="margin:0;color:#4b5468">Score trend</p>${chartHtml}` : "",
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
    chartHtml,
    sparkline: spark,
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

/** Digest recipients: the explicit list, falling back to the alert email. */
export function digestRecipients(monitor: MonitorRow): string[] {
  const list = (monitor.digestRecipients ?? []).filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  if (list.length > 0) return list;
  return monitor.notifyEmail ? [monitor.notifyEmail] : [];
}

function windowStart(monitor: MonitorRow, now: Date): Date {
  if (monitor.lastDigestAt) return monitor.lastDigestAt;
  const frequency = isDigestFrequency(monitor.digestFrequency) ? monitor.digestFrequency : "off";
  if (frequency !== "off") return new Date(now.getTime() - DIGEST_INTERVAL_MS[frequency]);
  return new Date(now.getTime() - DIGEST_INTERVAL_MS.weekly);
}

export interface DigestDeps {
  deliverEmail?: typeof sendEmail;
  deliverWebhook?: typeof sendWebhookWithRetry;
  allowPrivate?: boolean;
  signPayload?: boolean;
  baseUrl?: string;
  now?: Date;
}

export interface PreparedDigest {
  plan: DigestPlan;
  lastScanId: string;
}

/**
 * Gathers the window of scans and builds the digest plan without sending it.
 * Shared by the sender, the scheduler, and the preview endpoint.
 */
export async function prepareDigest(
  monitor: MonitorRow,
  deps: DigestDeps = {},
): Promise<PreparedDigest | null> {
  const now = deps.now ?? new Date();
  const start = windowStart(monitor, now);
  const history = (await getScansForUrl(monitor.normalizedUrl, 30))
    .slice()
    .reverse()
    .filter((scan) => scan.createdAt.getTime() >= start.getTime());

  if (history.length === 0) return null;

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

  if (!plan) return null;
  return { plan, lastScanId: last.id };
}

export function digestWebhookPayload(plan: DigestPlan, monitor: MonitorRow): Record<string, unknown> {
  return {
    text: plan.text,
    content: plan.text,
    subject: plan.subject,
    digest: true,
    monitor: { id: monitor.id, label: monitorLabel(monitor), url: monitor.normalizedUrl },
    score: plan.lastScore,
    previousScore: plan.firstScore,
    delta: plan.delta,
    newIssues: plan.added.map((finding) => ({
      ruleId: finding.ruleId,
      title: finding.title,
      severity: finding.severity,
    })),
    fixedIssues: plan.fixed.map((finding) => ({
      ruleId: finding.ruleId,
      title: finding.title,
      severity: finding.severity,
    })),
    reportUrl: plan.reportUrl,
    compareUrl: plan.compareUrl,
  };
}

export interface DigestDelivery {
  channel: "digest" | "webhook";
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
  const recipients = digestRecipients(monitor);
  const webhookUrl = monitor.notifyWebhookUrl;
  if (recipients.length === 0 && !webhookUrl) return [];

  const prepared = await prepareDigest(monitor, deps);
  if (!prepared) return [];
  const { plan, lastScanId } = prepared;
  const now = deps.now ?? new Date();
  const deliveries: DigestDelivery[] = [];

  if (recipients.length > 0) {
    const message = {
      to: recipients,
      subject: plan.subject,
      text: plan.text,
      html: plan.html,
    };
    const send = deps.deliverEmail ?? sendEmail;
    const outcome: EmailOutcome = await send(message);
    const delivery: DigestDelivery = {
      channel: "digest",
      target: recipients.join(", "),
      status: outcome.ok ? "sent" : outcome.detail === "email_not_configured" ? "skipped" : "failed",
      detail: outcome.detail,
    };
    deliveries.push(delivery);
    await insertNotification({
      monitorId: monitor.id,
      scanId: lastScanId,
      channel: "digest",
      target: delivery.target,
      status: delivery.status,
      detail: delivery.detail,
      payload: message as unknown as Record<string, unknown>,
    });
  }

  if (webhookUrl) {
    const send = deps.deliverWebhook ?? sendWebhookWithRetry;
    const payload = digestWebhookPayload(plan, monitor);
    const signingSecret =
      deps.signPayload === false ? null : await ensureWebhookSecret(monitor);
    const outcome = await send(webhookUrl, payload, {
      allowPrivate: deps.allowPrivate,
      signingSecret,
    });
    const attempts = outcome.attempts ?? 1;
    const delivery: DigestDelivery = {
      channel: "webhook",
      target: webhookUrl,
      status: outcome.ok ? "sent" : "failed",
      detail: attempts > 1 ? `${outcome.detail} (${attempts} attempts)` : outcome.detail,
    };
    deliveries.push(delivery);
    await insertNotification({
      monitorId: monitor.id,
      scanId: lastScanId,
      channel: "webhook",
      target: webhookUrl,
      status: delivery.status,
      detail: delivery.detail,
      attempts,
      payload: payload as unknown as Record<string, unknown>,
    });
  }

  if (deliveries.some((delivery) => delivery.status === "sent")) {
    await updateMonitor(monitor.id, { lastDigestAt: now });
  }

  return deliveries;
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
  const emailReady = emailConfigured() || Boolean(deps.deliverEmail);

  for (const monitor of monitors) {
    const frequency = isDigestFrequency(monitor.digestFrequency) ? monitor.digestFrequency : "off";
    if (!monitor.active || frequency === "off") continue;
    const hasEmail = digestRecipients(monitor).length > 0;
    const hasWebhook = Boolean(monitor.notifyWebhookUrl);
    if (!hasEmail && !hasWebhook) continue;
    if (hasEmail && !hasWebhook && !emailReady) continue;
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
