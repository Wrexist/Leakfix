export const SCAN_STATUSES = ["queued", "fetching", "analyzing", "completed", "failed"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const TERMINAL_STATUSES: readonly ScanStatus[] = ["completed", "failed"];

export const ALLOWED_TRANSITIONS: Record<ScanStatus, readonly ScanStatus[]> = {
  queued: ["fetching", "failed"],
  fetching: ["analyzing", "failed"],
  analyzing: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function isScanStatus(value: unknown): value is ScanStatus {
  return typeof value === "string" && (SCAN_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(status: ScanStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: ScanStatus, to: ScanStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ScanStatus, to: ScanStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid scan transition: ${from} -> ${to}`);
  }
}

export interface ScanStage {
  id: "connecting" | "analyzing";
  label: string;
  description: string;
}

/**
 * User-facing stages. They map one-to-one to real backend work: acquisition
 * (connect + fetch + follow redirects), then analysis (extract + checks +
 * score). There is deliberately no fake percentage or invented extra stage.
 */
export const SCAN_STAGES: readonly ScanStage[] = [
  {
    id: "connecting",
    label: "Connecting to website",
    description: "Reaching the page and following redirects.",
  },
  {
    id: "analyzing",
    label: "Analyzing the page",
    description: "Inspecting structure, running checks, and scoring findings.",
  },
];

/** Index of the stage currently in progress, or SCAN_STAGES.length when done. */
export function stageIndexForStatus(status: ScanStatus): number {
  switch (status) {
    case "queued":
    case "fetching":
      return 0;
    case "analyzing":
      return 1;
    case "completed":
    case "failed":
      return SCAN_STAGES.length;
    default:
      return 0;
  }
}
