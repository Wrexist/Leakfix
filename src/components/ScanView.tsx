"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { recordRecentScan } from "@/lib/recent-scans";
import type { ScanDto } from "@/lib/scan/dto";
import type { ScanHistoryData } from "@/lib/scan/history";
import { isTerminalStatus } from "@/lib/scan/state";

import { ScanErrorState } from "./ScanErrorState";
import { ScanReport } from "./report/ScanReport";
import { ScanningPanel } from "./ScanningPanel";

const POLL_INTERVAL_MS = 1200;
const EASE = [0.16, 1, 0.3, 1] as const;

export function ScanView({
  initialScan,
  history,
}: {
  initialScan: ScanDto;
  history: ScanHistoryData;
}) {
  const [scan, setScan] = useState<ScanDto>(initialScan);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (isTerminalStatus(scan.status)) return;

    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const response = await fetch(`/api/scans/${scan.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = (await response.json()) as ScanDto;
        if (!cancelled) setScan(next);
      } catch {
        // Transient network error; the next interval will retry.
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [scan.id, scan.status]);

  useEffect(() => {
    if (scan.status !== "completed") return;
    recordRecentScan({
      id: scan.id,
      url: scan.finalUrl ?? scan.normalizedUrl,
      score: scan.score,
    });
  }, [scan.id, scan.status, scan.score, scan.finalUrl, scan.normalizedUrl]);

  const view = scan.status === "failed" ? "failed" : scan.status === "completed" ? "report" : "scanning";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {view === "failed" ? <ScanErrorState scan={scan} /> : null}
        {view === "report" ? <ScanReport scan={scan} history={history} /> : null}
        {view === "scanning" ? <ScanningPanel scan={scan} /> : null}
      </motion.div>
    </AnimatePresence>
  );
}
