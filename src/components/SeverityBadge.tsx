import { SEVERITY_LABEL, type Severity } from "@/lib/scan/types";

const STYLES: Record<Severity, string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-sky-50 text-sky-700 ring-sky-200",
  info: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
