"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MonitorRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"scan" | "remove" | null>(null);

  async function scanNow() {
    if (busy) return;
    setBusy("scan");
    try {
      const response = await fetch(`/api/monitors/${id}`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { scanId?: string } | null;
      if (response.ok && payload?.scanId) {
        router.push(`/scan/${payload.scanId}`);
        return;
      }
      setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    try {
      const response = await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      if (response.ok || response.status === 204) {
        router.refresh();
        return;
      }
      setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={scanNow}
        disabled={busy !== null}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "scan" ? "Scanning…" : "Scan now"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "remove" ? "Removing…" : "Stop"}
      </button>
    </div>
  );
}
