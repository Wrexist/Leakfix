export interface EmailOutcome {
  ok: boolean;
  status: number | null;
  detail: string;
}

/**
 * Escapes text for interpolation into HTML (element content or quoted
 * attributes). Every user- or page-derived value in an email/HTML template —
 * monitor labels, URLs, finding titles — must pass through this.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  /** Extra headers, e.g. `List-Unsubscribe` on follow-up emails (Resend accepts these). */
  headers?: Record<string, string>;
}

/**
 * Email is sent through an HTTP email provider. Resend is the default; point
 * `EMAIL_API_URL` at another provider that accepts the same JSON shape if needed.
 * When credentials are absent, sending is skipped rather than throwing.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(
  message: EmailMessage,
  options: { timeoutMs?: number } = {},
): Promise<EmailOutcome> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, status: null, detail: "email_not_configured" };
  }

  const endpoint = process.env.EMAIL_API_URL ?? "https://api.resend.com/emails";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.headers ? { headers: message.headers } : {}),
      }),
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
