"use client";

import { useState } from "react";

/** Opens the Stripe Billing Portal for the signed-in user. */
export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.url) {
        setError(payload?.error?.message ?? "We couldn't open billing. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
