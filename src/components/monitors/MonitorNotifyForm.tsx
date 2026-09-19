"use client";

import { useState, type FormEvent } from "react";

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
  emailEnabled: boolean;
}

export function MonitorNotifyForm({
  id,
  webhookUrl,
  email,
  policy,
  emailEnabled,
}: MonitorNotifyFormProps) {
  const [webhook, setWebhook] = useState(webhookUrl ?? "");
  const [mail, setMail] = useState(email ?? "");
  const [policyValue, setPolicyValue] = useState<NotifyPolicy>(policy);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
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
        body: JSON.stringify({ webhookUrl: webhook, email: mail, notifyPolicy: policyValue }),
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
