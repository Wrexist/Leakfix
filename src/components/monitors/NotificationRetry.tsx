"use client";

import { useState } from "react";

export function NotificationRetry({
  monitorId,
  notificationId,
}: {
  monitorId: string;
  notificationId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(
        `/api/monitors/${monitorId}/notifications/${notificationId}/retry`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; delivery?: { status: string; detail: string } }
        | null;
      if (!response.ok) {
        setResult(payload?.error?.message ?? "Retry failed.");
        return;
      }
      setResult(`${payload?.delivery?.status ?? "done"} · ${payload?.delivery?.detail ?? ""}`);
    } catch {
      setResult("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="text-xs font-semibold text-brand hover:underline disabled:opacity-60"
      >
        {busy ? "Retrying…" : "Retry"}
      </button>
      {result ? <span className="text-xs text-ink-faint">{result}</span> : null}
    </span>
  );
}
