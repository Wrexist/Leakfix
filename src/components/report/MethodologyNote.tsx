import { SEVERITIES, SEVERITY_LABEL } from "@/lib/scan/types";

export function MethodologyNote() {
  return (
    <section className="mt-16 rounded-2xl border border-line bg-canvas p-6 sm:p-7">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
        How to read this report
      </h2>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">The score</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Every scan starts at 100. Each finding subtracts a fixed amount by severity. Checks that
            pass subtract nothing. The result is clamped to 0–100. It is a transparent product
            heuristic — not a measure of revenue, traffic, or conversion loss.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Severity</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {SEVERITIES.map((severity) => (
              <li key={severity} className="flex gap-2">
                <span className="font-semibold text-ink">{SEVERITY_LABEL[severity]}</span>
                <span>
                  {severity === "critical" || severity === "high"
                    ? "Fix first — affects trust, usability, or visibility."
                    : severity === "medium"
                      ? "Worth fixing soon."
                      : "Low priority polish."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-faint">
        Findings are produced by deterministic checks on the HTML LeakFix fetched. Checks that pass are
        listed under “What&apos;s already working”. If a check could not run, it is not counted as a
        failure.
      </p>
    </section>
  );
}
