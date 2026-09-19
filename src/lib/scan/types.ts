export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const CATEGORIES = [
  "Security",
  "SEO",
  "Accessibility",
  "Content",
  "Conversion",
  "Mobile",
  "Trust",
  "Local",
  "E-commerce",
  "Social",
  "App Store",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  Security: "Security",
  SEO: "SEO",
  Accessibility: "Accessibility",
  Content: "Content",
  Conversion: "Conversion",
  Mobile: "Mobile",
  Trust: "Trust & credibility",
  Local: "Local business",
  "E-commerce": "E-commerce",
  Social: "Social & sharing",
  "App Store": "App Store optimization",
};

export const SCAN_KINDS = ["website", "ios-app", "android-app"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

export const SCAN_KIND_LABEL: Record<ScanKind, string> = {
  website: "Website",
  "ios-app": "iPhone app",
  "android-app": "Android app",
};

export const SCAN_KIND_EXAMPLE: Record<ScanKind, string> = {
  website: "https://yourwebsite.com",
  "ios-app": "https://apps.apple.com/us/app/id284882215",
  "android-app": "https://play.google.com/store/apps/details?id=com.whatsapp",
};

export interface ScanSubject {
  kind: ScanKind;
  name: string | null;
  icon: string | null;
  developer: string | null;
  storeUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  installs: string | null;
}

export function isScanKind(value: unknown): value is ScanKind {
  return typeof value === "string" && (SCAN_KINDS as readonly string[]).includes(value);
}

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const IMPACTS = ["high", "medium", "low"] as const;
export type Impact = (typeof IMPACTS)[number];

export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

export interface FindingSnippet {
  language: "html" | "text" | "apache" | "nginx" | "json";
  code: string;
}

export interface FindingReference {
  label: string;
  url: string;
}

/**
 * Rich, actionable content attached to a finding. Everything here is derived
 * from the observed page — never invented.
 */
export interface FindingDetails {
  /** One sentence of user/business consequence. */
  whyItMatters: string;
  /** Ordered, concrete steps to fix the issue. */
  steps: string[];
  /** Optional copy-paste fix. */
  snippet?: FindingSnippet;
  /** One concrete way to confirm the fix worked. */
  verification: string;
  impact: Impact;
  effort: Effort;
  /** Optional authoritative further reading. */
  reference?: FindingReference;
}

export interface Finding {
  ruleId: string;
  category: Category;
  title: string;
  explanation: string;
  severity: Severity;
  evidence: string;
  recommendation: string;
  confidence: Confidence;
  details?: FindingDetails;
  /** True when fix details are withheld behind the paywall. */
  locked?: boolean;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export function emptySeverityCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

export interface CheckSummaryItem {
  id: string;
  label: string;
  category: Category;
  passed: boolean;
  findingCount: number;
}

export interface AuditSummary {
  checks: CheckSummaryItem[];
  passed: number;
  total: number;
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isImpact(value: unknown): value is Impact {
  return typeof value === "string" && (IMPACTS as readonly string[]).includes(value);
}

export function isEffort(value: unknown): value is Effort {
  return typeof value === "string" && (EFFORTS as readonly string[]).includes(value);
}
