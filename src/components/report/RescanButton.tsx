"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RescanButton({ url }: { url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRescan() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      if (response.ok && payload?.id) {
        router.push(`/scan/${payload.id}`);
        return;
      }
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRescan}
      disabled={busy}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-70"
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin-slow rounded-full border-2 border-ink/20 border-t-ink"
          />
          Re-scanning…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Re-scan
        </>
      )}
    </button>
  );
}
