"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { hostnameOf } from "@/lib/format";
import {
  clearRecentScans,
  getRecentScansServerSnapshot,
  getRecentScansSnapshot,
  subscribeRecentScans,
} from "@/lib/recent-scans";

export function RecentScans() {
  const items = useSyncExternalStore(
    subscribeRecentScans,
    getRecentScansSnapshot,
    getRecentScansServerSnapshot,
  );

  const visible = items.slice(0, 5);
  if (visible.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-6 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Your recent scans
        </h2>
        <button
          type="button"
          onClick={() => clearRecentScans()}
          className="text-xs font-medium text-ink-faint transition-colors hover:text-ink"
        >
          Clear
        </button>
      </div>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <Link
                href={`/scan/${item.id}`}
                className="block truncate text-sm font-semibold text-ink hover:underline"
              >
                {hostnameOf(item.url)}
              </Link>
              <p className="truncate text-xs text-ink-faint">{item.url}</p>
            </div>
            {item.score != null ? (
              <span className="shrink-0 rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-soft">
                {item.score}/100
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
