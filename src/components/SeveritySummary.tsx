import { SEVERITIES, type Severity, type SeverityCounts } from "@/lib/scan/types";

import { SeverityBadge } from "./SeverityBadge";

export function SeveritySummary({ counts }: { counts: SeverityCounts }) {
  const present = SEVERITIES.filter((severity: Severity) => counts[severity] > 0);

  if (present.length === 0) {
    return <p className="mt-4 text-sm text-ink-soft">No findings from the current checks.</p>;
  }

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-2">
      {present.map((severity) => (
        <li key={severity} className="inline-flex items-center gap-1.5">
          <SeverityBadge severity={severity} />
          <span className="text-sm font-medium tabular-nums text-ink-soft">{counts[severity]}</span>
        </li>
      ))}
    </ul>
  );
}
