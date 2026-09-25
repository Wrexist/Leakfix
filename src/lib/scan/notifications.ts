import type { MonitorRow } from "@/lib/db/schema";

import { compareScans, type ComparedFinding } from "./compare";
import { escapeHtml, sendEmail, type EmailMessage, type EmailOutcome } from "./email";
import { listMonitorsByUrl } from "./monitor-owner";
import { monitorLabel } from "./monitors";
import { isNotifyPolicy, type NotifyPolicy } from "./notify-policy";
import {
  ensureWebhookSecret,
  getFindingsForScan,
  getMonitorById,
  getNotificationById,
  getScanById,
  getScansForUrl,
  insertNotification,
  updateMonitor,
  updateNotification,
} from "./repository";
import {
  neutralizeMentions,
  sendWebhook,
  sendWebhookWithRetry,
  slackEscape,
  webhookFlavor,
  type DeliveryOutcome,
} from "./webhook";

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

/** Subjects are a single header line; never let a label carry line breaks. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
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

  const subject = oneLine(
    input.previousScore == null || input.score == null
      ? `LeakFix: ${input.label} first score ${input.score ?? "—"}`
      : `LeakFix: ${input.label} score ${trend} from ${input.previousScore} to ${input.score}`,
  );

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
  // Label, URL and finding titles are user/page-derived: escape all of them.
  const html = [
    `<p><strong>LeakFix monitoring — ${escapeHtml(input.label)}</strong></p>`,
    `<p>${escapeHtml(input.url)}</p>`,
    input.previousScore == null || input.score == null
      ? `<p>Score: <strong>${input.score ?? "—"}/100</strong></p>`
      : `<p>Score: <strong>${input.previousScore} → ${input.score}</strong> (${formatDelta(delta ?? 0)})</p>`,
    `<p>New issues: ${input.added.length} · Fixed: ${input.fixed.length}</p>`,
    input.added.length > 0
      ? `<ul>${input.added
          .slice(0, 5)
          .map((finding) => `<li>[${escapeHtml(finding.severity)}] ${escapeHtml(finding.title)}</li>`)
          .join("")}</ul>`
      : "",
    `<p><a href="${escapeHtml(reportUrl)}">View report</a>${
      compareUrl ? ` · <a href="${escapeHtml(compareUrl)}">Compare</a>` : ""
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
  /** Set false to disable HMAC signing (tests). Defaults to signing. */
  signPayload?: boolean;
}

function issueLines(findings: ComparedFinding[], limit = 5): string {
  if (findings.length === 0) return "None";
  return findings
    .slice(0, limit)
    .map((finding) => `• [${finding.severity}] ${finding.title}`)
    .join("\n");
}

function scoreLine(plan: NotificationPlan): string {
  return plan.previousScore == null || plan.score == null
    ? `${plan.score ?? "—"}/100`
    : `${plan.previousScore} → ${plan.score} (${formatDelta(plan.delta ?? 0)})`;
}

function slackBlocks(plan: NotificationPlan): unknown[] {
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: plan.subject, emoji: true } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Score*\n${slackEscape(scoreLine(plan))}` },
        { type: "mrkdwn", text: `*New / Fixed*\n${plan.added.length} / ${plan.fixed.length}` },
      ],
    },
  ];
  if (plan.added.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*New issues*\n${slackEscape(issueLines(plan.added))}` },
    });
  }
  if (plan.fixed.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Fixed*\n${slackEscape(issueLines(plan.fixed))}` },
    });
  }
  const elements: unknown[] = [
    { type: "button", text: { type: "plain_text", text: "View report" }, url: plan.reportUrl },
  ];
  if (plan.compareUrl) {
    elements.push({ type: "button", text: { type: "plain_text", text: "Compare" }, url: plan.compareUrl });
  }
  blocks.push({ type: "actions", elements });
  return blocks;
}

function discordEmbeds(plan: NotificationPlan, monitor: MonitorRow): unknown[] {
  const color =
    plan.delta != null && plan.delta < 0
      ? 0xc0272d
      : plan.delta != null && plan.delta > 0
        ? 0x0f7a56
        : 0x2f5bff;
  return [
    {
      title: neutralizeMentions(plan.subject),
      url: plan.reportUrl,
      description: `Score ${scoreLine(plan)}`,
      color,
      fields: [
        {
          name: `New issues (${plan.added.length})`,
          value: neutralizeMentions(issueLines(plan.added)),
          inline: false,
        },
        {
          name: `Fixed (${plan.fixed.length})`,
          value: neutralizeMentions(issueLines(plan.fixed)),
          inline: false,
        },
      ],
      footer: { text: neutralizeMentions(monitorLabel(monitor)) },
    },
  ];
}

/**
 * Builds a provider-native payload when the webhook target is Slack or Discord,
 * and a generic JSON payload otherwise. Exported for tests.
 */
export function buildWebhookPayload(
  plan: NotificationPlan,
  monitor: MonitorRow,
): Record<string, unknown> {
  // Chat-rendered text fields get mentions defused; structured fields stay raw.
  const chatText = neutralizeMentions(plan.text);
  const base: Record<string, unknown> = {
    text: chatText,
    content: chatText,
    subject: plan.subject,
    monitor: { id: monitor.id, label: monitorLabel(monitor), url: monitor.normalizedUrl },
    score: plan.score,
    previousScore: plan.previousScore,
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

  const flavor = webhookFlavor(monitor.notifyWebhookUrl);
  if (flavor === "slack") {
    return { ...base, text: slackEscape(plan.text), blocks: slackBlocks(plan) };
  }
  if (flavor === "discord") {
    return { ...base, allowed_mentions: { parse: [] }, embeds: discordEmbeds(plan, monitor) };
  }
  return base;
}

async function dispatch(
  monitor: MonitorRow,
  scanId: string | null,
  plan: NotificationPlan,
  deps: NotifyDeps,
): Promise<NotificationDelivery[]> {
  const deliveries: NotificationDelivery[] = [];

  if (monitor.notifyWebhookUrl) {
    const send = deps.deliverWebhook ?? sendWebhookWithRetry;
    const payload = buildWebhookPayload(plan, monitor);
    const signingSecret = deps.signPayload === false ? null : await ensureWebhookSecret(monitor);
    const outcome: DeliveryOutcome = await send(monitor.notifyWebhookUrl, payload, {
      allowPrivate: deps.allowPrivate,
      signingSecret,
    });
    const attempts = (outcome as { attempts?: number }).attempts ?? 1;
    const delivery: NotificationDelivery = {
      channel: "webhook",
      target: monitor.notifyWebhookUrl,
      status: outcome.ok ? "sent" : "failed",
      detail: attempts > 1 ? `${outcome.detail} (${attempts} attempts)` : outcome.detail,
    };
    deliveries.push(delivery);
    await insertNotification({
      monitorId: monitor.id,
      scanId,
      channel: delivery.channel,
      target: delivery.target,
      status: delivery.status,
      detail: delivery.detail,
      attempts,
      payload,
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
      payload: message as unknown as Record<string, unknown>,
    });
  }

  return deliveries;
}

/**
 * Retries a failed (or skipped) notification using its stored payload. Webhook
 * payloads are re-signed with the monitor's current secret.
 */
export async function retryNotification(
  notificationId: string,
  deps: NotifyDeps = {},
): Promise<NotificationDelivery | null> {
  const notification = await getNotificationById(notificationId);
  if (!notification) return null;

  let delivery: NotificationDelivery | null = null;

  if (notification.channel === "webhook") {
    const monitor = await getMonitorById(notification.monitorId);
    if (!monitor?.notifyWebhookUrl || !notification.payload) return null;
    const send = deps.deliverWebhook ?? sendWebhookWithRetry;
    const signingSecret = deps.signPayload === false ? null : await ensureWebhookSecret(monitor);
    const outcome: DeliveryOutcome = await send(monitor.notifyWebhookUrl, notification.payload, {
      allowPrivate: deps.allowPrivate,
      signingSecret,
    });
    const attempts = (outcome as { attempts?: number }).attempts ?? 1;
    delivery = {
      channel: "webhook",
      target: notification.target,
      status: outcome.ok ? "sent" : "failed",
      detail: attempts > 1 ? `${outcome.detail} (${attempts} attempts)` : outcome.detail,
    };
  } else if (notification.channel === "email" || notification.channel === "digest") {
    if (!notification.payload) return null;
    const send = deps.deliverEmail ?? sendEmail;
    const outcome: EmailOutcome = await send(notification.payload as unknown as EmailMessage);
    delivery = {
      channel: notification.channel as NotificationChannel,
      target: notification.target,
      status: outcome.ok ? "sent" : outcome.detail === "email_not_configured" ? "skipped" : "failed",
      detail: outcome.detail,
    };
  }

  if (!delivery) return null;

  await updateNotification(notification.id, {
    status: delivery.status,
    detail: delivery.detail,
    attempts: notification.attempts + 1,
  });
  return delivery;
}

/**
 * Called after a scan completes. Notifies every monitor of the URL (one per
 * owning browser) whose policy matches the change. Never throws — notifications
 * must not break scanning.
 */
export async function notifyMonitorChange(
  scanId: string,
  deps: NotifyDeps = {},
): Promise<NotificationDelivery[]> {
  try {
    const scan = await getScanById(scanId);
    if (!scan || scan.status !== "completed") return [];

    // Several browsers can monitor the same URL; each gets its own notification.
    const monitors = (await listMonitorsByUrl(scan.normalizedUrl)).filter(
      (monitor) => monitor.active && (monitor.notifyWebhookUrl || monitor.notifyEmail),
    );
    if (monitors.length === 0) return [];

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

    const allowPrivate =
      deps.allowPrivate ?? process.env.LEAKFIX_ALLOW_PRIVATE_TARGETS === "true";
    const deliveries: NotificationDelivery[] = [];

    for (const monitor of monitors) {
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
      if (!plan) continue;

      deliveries.push(...(await dispatch(monitor, scan.id, plan, { ...deps, allowPrivate })));
      await updateMonitor(monitor.id, { lastNotifiedAt: new Date(), lastNotifiedScore: scan.score });
    }
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
    subject: oneLine(`LeakFix test notification — ${monitorLabel(monitor)}`),
    text: `This is a test notification for ${monitorLabel(monitor)} (${monitor.normalizedUrl}). If you can read this, notifications are configured correctly.\n\n${base}/monitors`,
    html: `<p>This is a test notification for <strong>${escapeHtml(monitorLabel(monitor))}</strong>.</p><p><a href="${escapeHtml(`${base}/monitors`)}">Open monitors</a></p>`,
    reportUrl: base,
    compareUrl: null,
  };
  return dispatch(monitor, null, plan, deps);
}
