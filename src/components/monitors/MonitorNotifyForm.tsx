"use client";

import { useState, type FormEvent } from "react";

import { CopyButton } from "@/components/report/CopyButton";
import {
  DIGEST_FREQUENCIES,
  DIGEST_FREQUENCY_LABEL,
  isDigestFrequency,
  type DigestFrequency,
} from "@/lib/scan/digest-policy";
import {
  NOTIFY_POLICIES,
  NOTIFY_POLICY_LABEL,
  type NotifyPolicy,
} from "@/lib/scan/notify-policy";

interface MonitorNotifyFormProps {
  id: string;
  webhookUrl: string | null;
  email: string | null;
  policy: NotifyPolicy;
  digestFrequency: string;
  digestRecipients: string[];
  webhookSecret: string | null;
  emailEnabled: boolean;
}

function maskSecret(secret: string): string {
  if (secret.length <= 16) return secret;
  return `${secret.slice(0, 11)}…${secret.slice(-4)}`;
}

export function MonitorNotifyForm({
  id,
  webhookUrl,
  email,
  policy,
  digestFrequency,
  digestRecipients,
  webhookSecret,
  emailEnabled,
}: MonitorNotifyFormProps) {
  const [webhook, setWebhook] = useState(webhookUrl ?? "");
  const [mail, setMail] = useState(email ?? "");
  const [policyValue, setPolicyValue] = useState<NotifyPolicy>(policy);
  const [digest, setDigest] = useState<DigestFrequency>(
    isDigestFrequency(digestFrequency) ? digestFrequency : "off",
  );
  const [recipients, setRecipients] = useState(digestRecipients.join(", "));
  const [secret, setSecret] = useState(webhookSecret);
  const [busy, setBusy] = useState<"save" | "test" | "digest" | "rotate" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webhookUrl: webhook,
          email: mail,
          notifyPolicy: policyValue,
          digestFrequency: digest,
          digestRecipients: recipients
            .split(/[,\s]+/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload?.error?.message ?? "Could not save settings." });
        return;
      }
      setMessage({ tone: "ok", text: "Notification settings saved." });
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function sendDigestNow() {
    if (busy) return;
    setBusy("digest");
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${id}/digest`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; deliveries?: { channel: string; status: string; detail: string }[] }
        | null;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload?.error?.message ?? "Could not send a digest." });
        return;
      }
      const deliveries = payload?.deliveries ?? [];
      setMessage({
        tone: "ok",
        text:
          deliveries.length > 0
            ? deliveries.map((d) => `${d.channel}: ${d.status} (${d.detail})`).join(" · ")
            : "Nothing to summarise yet.",
      });
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function rotateSecret() {
    if (busy) return;
    setBusy("rotate");
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${id}/secret`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; webhookSecret?: string }
        | null;
      if (!response.ok || !payload?.webhookSecret) {
        setMessage({ tone: "error", text: payload?.error?.message ?? "Could not rotate the secret." });
        return;
      }
      setSecret(payload.webhookSecret);
      setMessage({ tone: "ok", text: "New signing secret generated. Update your receiver." });
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy("test");
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${id}/test`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; deliveries?: { channel: string; status: string; detail: string }[] }
        | null;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload?.error?.message ?? "Could not send a test." });
        return;
      }
      const deliveries = payload?.deliveries ?? [];
      setMessage({
        tone: "ok",
        text:
          deliveries.length > 0
            ? deliveries.map((d) => `${d.channel}: ${d.status} (${d.detail})`).join(" · ")
            : "No channels configured.",
      });
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-ink">Webhook URL</span>
        <input
          id={`notify-webhook-${id}`}
          type="url"
          inputMode="url"
          value={webhook}
          onChange={(event) => setWebhook(event.target.value)}
          placeholder="https://hooks.slack.com/services/…"
          className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-brand"
        />
        <span className="mt-1 block text-xs text-ink-faint">
          Sends JSON (works with Slack, Discord, or any endpoint).
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-ink">Email</span>
        <input
          id={`notify-email-${id}`}
          type="email"
          value={mail}
          onChange={(event) => setMail(event.target.value)}
          placeholder="you@company.com"
          disabled={!emailEnabled}
          className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-brand disabled:bg-canvas disabled:text-ink-faint"
        />
        <span className="mt-1 block text-xs text-ink-faint">
          {emailEnabled
            ? "Sent through your configured email provider."
            : "Set EMAIL_API_KEY and EMAIL_FROM on the server to enable email."}
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-ink">Notify me</span>
        <select
          id={`notify-policy-${id}`}
          value={policyValue}
          onChange={(event) => setPolicyValue(event.target.value as NotifyPolicy)}
          className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-brand"
        >
          {NOTIFY_POLICIES.map((option) => (
            <option key={option} value={option}>
              {NOTIFY_POLICY_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-ink">Email digest</span>
        <select
          id={`notify-digest-${id}`}
          value={digest}
          onChange={(event) => setDigest(event.target.value as DigestFrequency)}
          className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-brand"
        >
          {DIGEST_FREQUENCIES.map((option) => (
            <option key={option} value={option}>
              {DIGEST_FREQUENCY_LABEL[option]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink-faint">
          Summarises scans since the last digest. Sent by the daily/weekly cron.
        </span>
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="font-medium text-ink">Digest recipients</span>
        <input
          id={`notify-recipients-${id}`}
          type="text"
          value={recipients}
          onChange={(event) => setRecipients(event.target.value)}
          placeholder="ops@example.com, founder@example.com"
          className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus-visible:border-brand"
        />
        <span className="mt-1 block text-xs text-ink-faint">
          Comma-separated. Falls back to the email above when empty.
        </span>
      </label>

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-ink">Webhook signing secret</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink-soft">
            {secret ? maskSecret(secret) : "Save a webhook URL to generate a secret"}
          </code>
          {secret ? <CopyButton value={secret} label="Copy" /> : null}
          <button
            type="button"
            onClick={rotateSecret}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "rotate" ? "Rotating…" : "Rotate"}
          </button>
        </div>
        <span className="mt-1 block text-xs text-ink-faint">
          Each request is signed: <code className="font-mono">X-LeakFix-Signature: sha256=HMAC(secret, timestamp.body)</code>
        </span>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "test" ? "Sending…" : "Send test"}
        </button>
        <button
          type="button"
          onClick={sendDigestNow}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "digest" ? "Sending…" : "Send digest now"}
        </button>
        <a
          href={`/api/monitors/${id}/digest/preview`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
        >
          Preview digest
        </a>
      </div>

      {message ? (
        <p
          role="status"
          className={`sm:col-span-2 text-sm font-medium ${
            message.tone === "ok" ? "text-positive" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
