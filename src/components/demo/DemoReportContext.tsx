"use client";

import { createContext, useContext } from "react";

import type { ScanDto } from "@/lib/scan/dto";

export interface DemoReportActions {
  /** The report as currently shown: the free preview or the unlocked version. */
  scan: ScanDto;
  /** Unlocks the full report. The demo takes no payment. */
  unlock: () => void;
  /** Plays the scan again. */
  rescan: () => void;
}

export const DemoReportContext = createContext<DemoReportActions | null>(null);

/**
 * Report actions inside the static demo, where there is no API to call.
 * Always null in the real app.
 */
export function useDemoReport(): DemoReportActions | null {
  return useContext(DemoReportContext);
}
