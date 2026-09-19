import type { MonitorRow } from "@/lib/db/schema";

import { compareScans, type ComparedFinding } from "./compare";
import { sendEmail, type EmailMessage, type EmailOutcome } from "./email";
import { monitorLabel } from "./monitors";
import { isNotifyPolicy, type NotifyPolicy } from "./notify-policy";
import {
  getFindingsForScan,
  getMonitorByUrl,
  getScanById,
  getScansForUrl,
  insertNotification,
  updateMonitor,
} from "./repository";
import { sendWebhook, type DeliveryOutcome } from "./webhook";

export { isNotifyPolicy, NOTIFY_POLICIES, NOTIFY_POLICY_LABEL } from "./notify-policy";
export type { NotifyPolicy } from "./notify-policy";

export type NotificationChannel = "webhook" | "email";

export interface NotificationDelivery {
  channel: NotificationChannel;
  target: string;
  status: "sent" | "failed" | "skipped";
  detail: string;
}

export interface NotificationPlan {
  policy: NotifyPolicy;
  previousScore: number | null;
  score: number | null;
  delta: number | null;
  added: ComparedFinding[];
  fixed: ComparedFinding[];
  subject: string;
  text: string;
  html: string;
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

export function shouldNotify(
  policy: NotifyPolicy,
  previousScore: number | null,
  score: number | null,
): boolean {
  if (policy === "always") return true;
  if (previousScore == null || score == null) return false;
  if (policy === "change") return score !== previousScore;
  return score < previousScore;
}

function trendWord(previousScore: number | null, score: number | null, delta: number | null): string {
  if (previousScore == null || delta == null) return "first score";
  if (delta > 0) return "improved";
  if (delta < 0) return "dropped";
  return "unchanged";
}

/** Pure: decides whether to notify and builds the message. */
export function planNotification(input: {
  policy: NotifyPolicy;
  label: string;
  url: string;
  previousScore: number | null;
  score: number | null;
  added: ComparedFinding[];
  fixed: ComparedFinding[];
  scanId: string;
  previousId: string | null;
  baseUrl?: string;
}): NotificationPlan | null {
  if (!shouldNotify(input.policy, input.previousScore, input.score)) return null;

  const base = siteBaseUrl(input.baseUrl);
  const delta =
    input.previousScore != null && input.score != null ? input.score - input.previousScore : null;
  const reportUrl = `${base}/scan/${input.scanId}`;
  const compareUrl = input.previousId ? `${base}/compare?a=${input.previousId}&b=${input.scanId}` : null;
  const trend = trendWord(input.previousScore, input.score, delta);

  const subject =
    input.previousScore == null || input.score == null
      ? `LeakFix: ${input.label} first score ${input.score ?? "—"}`
      : `LeakFix: ${input.label} score ${trend} from ${input.previousScore} to ${input.score}`;

  const lines: string[] = [
    `LeakFix monitoring — ${input.label}`,
    input.url,
    "",
    input.previousScore == null || input.score == null
      ? `Score: ${input.score ?? "—"}/100`
      : `Score: ${input.previousScore} → ${input.score} (${formatDelta(delta ?? 0)})`,
    `New issues: ${input.added.length}`,
    `Fixed: ${input.fixed.length}`,
  ];

  if (input.added.length > 0) {
    lines.push("", "New issues:");
    for (const finding of input.added.slice(0, 5)) {
      lines.push(`  • [${finding.severity}] ${finding.title}`);
    }
  }
  if (input.fixed.length > 0) {
    lines.push("", "Fixed:");
    for (const finding of input.fixed.slice(0, 5)) {
      lines.push(`  • ${finding.title}`);
    }
  }
  lines.push("", `Report: ${reportUrl}`);
  if (compareUrl) lines.push(`Compare: ${compareUrl}`);

  const text = lines.join("\n");
  const html = [
    `<p><strong>LeakFix monitoring — ${input.label}</strong></p>`,
    `<p>${input.url}</p>`,
    input.previousScore == null || input.score == null
      ? `<p>Score: <strong>${input.score ?? "—"}/100</strong></p>`
      : `<p>Score: <strong>${input.previousScore} → ${input.score}</strong> (${formatDelta(delta ?? 0)})</p>`,
    `<p>New issues: ${input.added.length} · Fixed: ${input.fixed.length}</p>`,
    input.added.length > 0
      ? `<ul>${input.added
          .slice(0, 5)
          .map((finding) => `<li>[${finding.severity}] ${finding.title}</li>`)
          .join("")}</ul>`
      : "",
    `<p><a href="${reportUrl}">View report</a>${
      compareUrl ? ` · <a href="${compareUrl}">Compare</a>` : ""
    }</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    policy: input.policy,
    previousScore: input.previousScore,
    score: input.score,
    delta,
    added: input.added,
    fixed: input.fixed,
    subject,
    text,
    html,
    reportUrl,
    compareUrl,
  };
}

export interface NotifyDeps {
  deliverWebhook?: typeof sendWebhook;
  deliverEmail?: typeof sendEmail;
  allowPrivate?: boolean;
  baseUrl?: string;
}

async function dispatch(
  monitor: MonitorRow,
  scanId: string | null,
  plan: NotificationPlan,
  deps: NotifyDeps,
): Promise<NotificationDelivery[]> {
  const deliveries: NotificationDelivery[] = [];

  if (monitor.notifyWebhookUrl) {
    const send = deps.deliverWebhook ?? sendWebhook;
    const payload = {
      text: plan.text,
      content: plan.text,
      subject: plan.subject,
      monitor: { id: monitor.id, label: monitorLabel(monitor), url: monitor.normalizedUrl },
      score: plan.score,
      previousScore: plan.previousScore,
      delta: plan.delta,
      newIssues: plan.added.map((finding) => ({ ruleId: finding.ruleId, title: finding.title, severity: finding.severity })),
      fixedIssues: plan.fixed.map((finding) => ({ ruleId: finding.ruleId, title: finding.title, severity: finding.severity })),
      reportUrl: plan.reportUrl,
      compareUrl: plan.compareUrl,
    };
    const outcome: DeliveryOutcome = await send(monitor.notifyWebhookUrl, payload, {
      allowPrivate: deps.allowPrivate,
    });
    const delivery: NotificationDelivery = {
      channel: "webhook",
      target: monitor.notifyWebhookUrl,
      status: outcome.ok ? "sent" : "failed",
      detail: outcome.detail,
    };
    deliveries.push(delivery);
    await insertNotification({
      monitorId: monitor.id,
      scanId,
      channel: delivery.channel,
      target: delivery.target,
      status: delivery.status,
      detail: delivery.detail,
    });
  }

  if (monitor.notifyEmail) {
    const send = deps.deliverEmail ?? sendEmail;
    const message: EmailMessage = {
      to: monitor.notifyEmail,
      subject: plan.subject,
      text: plan.text,
      html: plan.html,
    };
    const outcome: EmailOutcome = await send(message);
    const delivery: NotificationDelivery = {
      channel: "email",
      target: monitor.notifyEmail,
      status: outcome.ok ? "sent" : outcome.detail === "email_not_configured" ? "skipped" : "failed",
      detail: outcome.detail,
    };
    deliveries.push(delivery);
    await insertNotification({
      monitorId: monitor.id,
      scanId,
      channel: delivery.channel,
      target: delivery.target,
      status: delivery.status,
      detail: delivery.detail,
    });
  }

  return deliveries;
}

/**
 * Called after a scan completes. Sends a notification when the monitor's policy
 * matches the change. Never throws — notifications must not break scanning.
 */
export async function notifyMonitorChange(
  scanId: string,
  deps: NotifyDeps = {},
): Promise<NotificationDelivery[]> {
  try {
    const scan = await getScanById(scanId);
    if (!scan || scan.status !== "completed") return [];

    const monitor = await getMonitorByUrl(scan.normalizedUrl);
    if (!monitor || !monitor.active) return [];
    if (!monitor.notifyWebhookUrl && !monitor.notifyEmail) return [];

    const history = await getScansForUrl(scan.normalizedUrl, 6);
    const previous = history.find((row) => row.id !== scan.id) ?? null;

    const [findings, previousFindings] = await Promise.all([
      getFindingsForScan(scan.id),
      previous ? getFindingsForScan(previous.id) : Promise.resolve([]),
    ]);

    const diff = compareScans(
      { findings: previousFindings, score: previous?.score ?? null },
      { findings, score: scan.score },
    );

    const policy: NotifyPolicy = isNotifyPolicy(monitor.notifyPolicy) ? monitor.notifyPolicy : "drop";

    const plan = planNotification({
      policy,
      label: monitorLabel(monitor),
      url: scan.normalizedUrl,
      previousScore: previous?.score ?? null,
      score: scan.score,
      added: diff.added,
      fixed: diff.fixed,
      scanId: scan.id,
      previousId: previous?.id ?? null,
      baseUrl: deps.baseUrl,
    });
    if (!plan) return [];

    const allowPrivate =
      deps.allowPrivate ?? process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS === "true";
    const deliveries = await dispatch(monitor, scan.id, plan, { ...deps, allowPrivate });
    await updateMonitor(monitor.id, { lastNotifiedAt: new Date(), lastNotifiedScore: scan.score });
    return deliveries;
  } catch {
    return [];
  }
}

/** Sends a test notification to every configured channel for a monitor. */
export async function sendTestNotification(
  monitor: MonitorRow,
  deps: NotifyDeps = {},
): Promise<NotificationDelivery[]> {
  const base = siteBaseUrl(deps.baseUrl);
  const plan: NotificationPlan = {
    policy: isNotifyPolicy(monitor.notifyPolicy) ? monitor.notifyPolicy : "drop",
    previousScore: monitor.lastScore,
    score: monitor.lastScore,
    delta: 0,
    added: [],
    fixed: [],
    subject: `LeakFix test notification — ${monitorLabel(monitor)}`,
    text: `This is a test notification for ${monitorLabel(monitor)} (${monitor.normalizedUrl}). If you can read this, notifications are configured correctly.\n\n${base}/monitors`,
    html: `<p>This is a test notification for <strong>${monitorLabel(monitor)}</strong>.</p><p><a href="${base}/monitors">Open monitors</a></p>`,
    reportUrl: base,
    compareUrl: null,
  };
  return dispatch(monitor, null, plan, deps);
}
