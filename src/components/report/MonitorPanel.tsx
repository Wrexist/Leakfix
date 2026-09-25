"use client";

import Link from "next/link";
import { useState } from "react";

export function MonitorPanel({
  url,
  initiallyMonitored,
  locked = false,
}: {
  url: string;
  initiallyMonitored: boolean;
  /** Monitoring is part of the full report; locked reports point at the paywall. */
  locked?: boolean;
}) {
  const [monitored, setMonitored] = useState(initiallyMonitored);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMonitor() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "We couldn't start monitoring. Try again.");
        setBusy(false);
        return;
      }
      setMonitored(true);
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink">Monitoring</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {monitored
            ? "This target is monitored. Re-scan it on a schedule and track the score over time."
            : locked
              ? "Monitoring comes with the full report: automatic re-scans, score trends, and alerts when something breaks."
              : "Get this target re-scanned automatically and watch the score trend over time."}
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        {monitored ? (
          <Link
            href="/monitors"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Manage monitors
          </Link>
        ) : locked ? (
          <a
            href="#unlock"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
          >
            Unlock to monitor
          </a>
        ) : (
          <button
            type="button"
            onClick={handleMonitor}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/40 border-t-white"
                />
                Starting…
              </>
            ) : (
              "Monitor this target"
            )}
          </button>
        )}
      </div>
    </section>
  );
}
