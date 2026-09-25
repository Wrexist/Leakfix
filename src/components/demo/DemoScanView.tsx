"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import type { BillingInfo } from "@/lib/billing/pricing";
import { clearDemoRun, pendingDemoRun } from "@/lib/demo";
import { recordRecentScan } from "@/lib/recent-scans";
import type { ScanDto } from "@/lib/scan/dto";
import type { ScanHistoryData } from "@/lib/scan/history";
import type { ScanStatus } from "@/lib/scan/state";

import { ScanReport } from "../report/ScanReport";
import { ScanningPanel } from "../ScanningPanel";
import { DemoReportContext, type DemoReportActions } from "./DemoReportContext";

const EASE = [0.16, 1, 0.3, 1] as const;
const NO_HISTORY: ScanHistoryData = { entries: [], diff: null };
/** Share of the simulated scan spent "connecting" before analysis starts. */
const CONNECTING_SHARE = 0.45;

/**
 * The demo's stand-in for ScanView. Coming from the scan form, it plays the
 * scanning screen for the scan's recorded duration, then shows the free
 * preview; unlocking swaps in the full report without a payment.
 */
export function DemoScanView({
  preview,
  full,
  billing,
}: {
  preview: ScanDto;
  full: ScanDto;
  billing: BillingInfo;
}) {
  const reduce = useReducedMotion();
  // Only a client-side navigation from the form can have a pending run, so the
  // prerendered HTML (always the finished report) still hydrates cleanly.
  const [status, setStatus] = useState<ScanStatus>(() =>
    typeof window !== "undefined" && pendingDemoRun() === preview.id ? "fetching" : "completed",
  );
  const [unlocked, setUnlocked] = useState(false);
  const scan = unlocked ? full : preview;

  useEffect(() => {
    clearDemoRun();
  }, []);

  useEffect(() => {
    if (status === "completed") return;
    const total = preview.durationMs ?? 3000;
    const connecting = status !== "analyzing";
    const timer = window.setTimeout(
      () => setStatus(connecting ? "analyzing" : "completed"),
      total * (connecting ? CONNECTING_SHARE : 1 - CONNECTING_SHARE),
    );
    return () => window.clearTimeout(timer);
  }, [status, preview.durationMs]);

  useEffect(() => {
    if (status !== "completed") return;
    recordRecentScan({
      id: preview.id,
      url: preview.finalUrl ?? preview.normalizedUrl,
      score: preview.score,
    });
  }, [status, preview.id, preview.finalUrl, preview.normalizedUrl, preview.score]);

  const actions = useMemo<DemoReportActions>(
    () => ({
      scan,
      unlock: () => {
        setUnlocked(true);
        // Land on the list of now-unlocked fixes rather than where the paywall was.
        window.requestAnimationFrame(() =>
          document
            .getElementById("findings")
            ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
        );
      },
      rescan: () => {
        setStatus("fetching");
        window.scrollTo({ top: 0 });
      },
    }),
    [scan, reduce],
  );

  const view = status === "completed" ? "report" : "scanning";

  return (
    <DemoReportContext.Provider value={actions}>
      {unlocked && view === "report" ? <UnlockedBanner /> : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          {view === "report" ? (
            <ScanReport scan={scan} history={NO_HISTORY} monitored={false} billing={billing} />
          ) : (
            <ScanningPanel scan={{ ...scan, status }} />
          )}
        </motion.div>
      </AnimatePresence>
    </DemoReportContext.Provider>
  );
}

function UnlockedBanner() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8 print:hidden">
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
      >
        <p className="text-sm font-semibold">Full report unlocked.</p>
        <p className="mt-0.5 text-sm opacity-80">
          Every fix and export is open. This is the demo, so no payment was taken.
        </p>
      </div>
    </div>
  );
}
