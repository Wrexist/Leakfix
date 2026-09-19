import type { ScanDto } from "@/lib/scan/dto";
import { buildExecutiveSummary } from "@/lib/scan/summary";

export function ExecutiveSummary({ scan }: { scan: ScanDto }) {
  const text = buildExecutiveSummary({
    findings: scan.findings,
    score: scan.score,
    checksRun: scan.auditSummary?.total ?? 0,
  });

  return (
    <section className="mt-8 rounded-2xl border border-brand/15 bg-brand-soft p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">In short</p>
      <p className="mt-2 leading-relaxed text-ink">{text}</p>
    </section>
  );
}
