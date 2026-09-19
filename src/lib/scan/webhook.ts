import { resolveAndValidateHost } from "./fetcher";
import { validateUrlInput } from "./url";

export interface DeliveryOutcome {
  ok: boolean;
  status: number | null;
  detail: string;
}

const USER_AGENT = "LeakFixBot/0.1 (+https://leakfix.example/bot)";

/**
 * Sends a JSON webhook with the same network-target policy as the scanner:
 * https only (unless explicitly allowed for tests), DNS re-validation, and
 * private/loopback ranges blocked. This prevents notification URLs from being
 * used as an SSRF primitive.
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  options: { allowPrivate?: boolean; timeoutMs?: number } = {},
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

  try {
    const response = await fetch(validation.target.href, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(payload),
    });
    await response.body?.cancel().catch(() => undefined);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      detail: `http_${response.status}`,
    };
  } catch (error) {
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
    });
    if (outcome.ok || !isRetryable(outcome) || attempt === attemptsAllowed) {
      return { ...outcome, attempts: attempt };
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  return { ...outcome, attempts: attemptsAllowed };
}
