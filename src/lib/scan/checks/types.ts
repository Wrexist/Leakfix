import type { PageSnapshot } from "../extract";
import type { Category, Confidence, Finding, FindingDetails, Severity } from "../types";

export interface CheckContext {
  snapshot: PageSnapshot;
}

export interface AuditCheck {
  /** Stable identifier, stored on every finding so rules can evolve safely. */
  id: string;
  /** Human-readable name shown in "what we checked". */
  label: string;
  category: Category;
  description: string;
  /** Every rule id this check can emit, used to compute pass/fail. */
  ruleIds: readonly string[];
  /** Returns zero or more findings. An empty array means the check passed. */
  run(context: CheckContext): Finding[];
}

export interface FindingInput {
  ruleId: string;
  category: Category;
  title: string;
  explanation: string;
  severity: Severity;
  evidence: string;
  recommendation: string;
  confidence?: Confidence;
  details: FindingDetails & { confidence?: Confidence };
}

export function finding(input: FindingInput): Finding {
  const { details, ...rest } = input;
  const { confidence: detailsConfidence, ...cleanDetails } = details;

  return {
    ...rest,
    confidence: rest.confidence ?? detailsConfidence ?? "high",
    details: cleanDetails,
  };
}
