import type { Effort, Impact } from "@/lib/scan/types";

const IMPACT_STYLE: Record<Impact, string> = {
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  low: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

const EFFORT_STYLE: Record<Effort, string> = {
  low: "bg-positive-soft text-positive ring-positive/20",
  medium: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  high: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

const IMPACT_LABEL: Record<Impact, string> = { high: "High impact", medium: "Medium impact", low: "Low impact" };
const EFFORT_LABEL: Record<Effort, string> = { low: "Quick to fix", medium: "Moderate effort", high: "More effort" };

export function ImpactEffort({
  impact,
  effort,
  quickWin = false,
}: {
  impact: Impact;
  effort: Effort;
  quickWin?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${IMPACT_STYLE[impact]}`}
      >
        {IMPACT_LABEL[impact]}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${EFFORT_STYLE[effort]}`}
      >
        {EFFORT_LABEL[effort]}
      </span>
      {quickWin ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/15">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
          </svg>
          Quick win
        </span>
      ) : null}
    </div>
  );
}
