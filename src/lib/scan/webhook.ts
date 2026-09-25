import { createHmac } from "node:crypto";

import { classifyFetchError, resolveAndValidateHost } from "./fetcher";
import { withPinnedDispatcher } from "./pinned-dns";
import { validateUrlInput } from "./url";

export interface DeliveryOutcome {
  ok: boolean;
  status: number | null;
  detail: string;
}

const USER_AGENT = "LeakFixBot/0.1 (+https://leakfix.example/bot)";

export type WebhookFlavor = "slack" | "discord" | "generic";

/** Which chat provider (if any) a webhook URL points at. */
export function webhookFlavor(url: string | null): WebhookFlavor {
  if (!url) return "generic";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "generic";
  }
  if (host === "hooks.slack.com") return "slack";
  if (host === "discord.com" || host === "discordapp.com" || host.endsWith(".discord.com")) {
    return "discord";
  }
  return "generic";
}

/**
 * Defuses mass mentions in text that ends up in a chat message. Finding titles
 * and labels come from scanned pages, so they must not be able to ping a channel.
 */
export function neutralizeMentions(value: string): string {
  return value
    .replace(/@(everyone|here|channel)/gi, "@\u200b$1")
    .replace(/<([!@#])/g, "<\u200b$1");
}

/**
 * Escapes Slack mrkdwn control characters so page-derived text cannot inject
 * links (`<url|text>`) or mentions (`<!channel>`, `<@U123>`).
 */
export function slackEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HMAC-SHA256 of `timestamp.body`, hex encoded (Stripe-style scheme). */
export function signPayload(secret: string, timestamp: string | number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export interface WebhookRequest {
  body: string;
  headers: Record<string, string>;
}

/** Builds the exact body and headers sent to a webhook (exported for tests). */
export function buildWebhookRequest(
  payload: unknown,
  options: { signingSecret?: string | null; timestamp?: number; userAgent?: string } = {},
): WebhookRequest {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": options.userAgent ?? USER_AGENT,
    "x-leakfix-event": "monitor.change",
  };

  if (options.signingSecret) {
    const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    headers["x-leakfix-timestamp"] = timestamp;
    headers["x-leakfix-signature"] = `sha256=${signPayload(options.signingSecret, timestamp, body)}`;
  }

  return { body, headers };
}

/**
 * Sends a JSON webhook with the same network-target policy as the scanner:
 * https only (unless explicitly allowed for tests), DNS re-validation, and
 * private/loopback ranges blocked, with the connection pinned to the validated
 * address (see pinned-dns.ts). This prevents notification URLs from being used
 * as an SSRF primitive, including via DNS rebinding.
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  options: { allowPrivate?: boolean; timeoutMs?: number; signingSecret?: string | null } = {},
): Promise<DeliveryOutcome> {
  const allowPrivate = options.allowPrivate ?? false;
  const timeoutMs = options.timeoutMs ?? 8000;

  const validation = validateUrlInput(url, { allowPrivate });
  if (!validation.ok) {
    return { ok: false, status: null, detail: `invalid_url_${validation.code}` };
  }
  if (!allowPrivate && validation.target.protocol !== "https:") {
    return { ok: false, status: null, detail: "https_required" };
  }

  const hostCheck = await resolveAndValidateHost(validation.target.hostname, allowPrivate);
  if (!hostCheck.ok) {
    return { ok: false, status: null, detail: `blocked_${hostCheck.code}` };
  }

  const request = buildWebhookRequest(payload, { signingSecret: options.signingSecret });

  try {
    const response = await fetch(
      validation.target.href,
      withPinnedDispatcher(
        {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers: request.headers,
          body: request.body,
        },
        allowPrivate,
      ),
    );
    await response.body?.cancel().catch(() => undefined);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      detail: `http_${response.status}`,
    };
  } catch (error) {
    // A connect-time rebinding block is permanent, so it must not be retried.
    if (classifyFetchError(error).code === "BLOCKED_TARGET") {
      return { ok: false, status: null, detail: "blocked_BLOCKED_TARGET" };
    }
    const name = (error as { name?: string }).name ?? "error";
    return { ok: false, status: null, detail: `network_${name}` };
  }
}

export interface RetryOutcome extends DeliveryOutcome {
  attempts: number;
}

export interface WebhookRetryOptions {
  allowPrivate?: boolean;
  timeoutMs?: number;
  attempts?: number;
  baseDelayMs?: number;
  signingSecret?: string | null;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to the real sender. */
  send?: typeof sendWebhook;
}

/** Retry transient failures (network errors, 429, and 5xx) — not 4xx client errors. */
export function isRetryable(outcome: DeliveryOutcome): boolean {
  if (outcome.detail.startsWith("network_")) return true;
  if (outcome.status === 429) return true;
  if (outcome.status != null && outcome.status >= 500) return true;
  return false;
}

/**
 * Sends a webhook with exponential backoff. Retries only transient failures so
 * a misconfigured URL is not hammered.
 */
export async function sendWebhookWithRetry(
  url: string,
  payload: unknown,
  options: WebhookRetryOptions = {},
): Promise<RetryOutcome> {
  const attemptsAllowed = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 400;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const send = options.send ?? sendWebhook;

  let outcome: DeliveryOutcome = { ok: false, status: null, detail: "not_attempted" };

  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    outcome = await send(url, payload, {
      allowPrivate: options.allowPrivate,
      timeoutMs: options.timeoutMs,
      signingSecret: options.signingSecret,
    });
    if (outcome.ok || !isRetryable(outcome) || attempt === attemptsAllowed) {
      return { ...outcome, attempts: attempt };
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  return { ...outcome, attempts: attemptsAllowed };
}
