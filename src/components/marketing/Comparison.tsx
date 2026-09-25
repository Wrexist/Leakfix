import { Reveal } from "../motion/Reveal";

const ROWS = [
  { label: "Where the problems are", old: "Guessing from gut feel", next: "Measured on your actual page" },
  { label: "What to fix first", old: "Everything feels urgent", next: "A ranked action plan" },
  { label: "What the fix is", old: "Vague advice from a blog", next: "Steps and copy-paste snippets" },
  { label: "Time to the first answer", old: "Days of audits and meetings", next: "Seconds — the scan is free" },
];

export function Comparison() {
  return (
    <section className="border-y border-line bg-canvas">
      <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
            Stop guessing. Start fixing.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            The difference between a leak you live with and a leak you fix is knowing it is there.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="grid grid-cols-3 gap-4 border-b border-line bg-canvas px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint sm:px-6">
              <span />
              <span>Without LeakFix</span>
              <span className="text-brand">With LeakFix</span>
            </div>
            <ul>
              {ROWS.map((row) => (
                <li
                  key={row.label}
                  className="grid grid-cols-3 items-start gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:px-6"
                >
                  <span className="text-sm font-medium text-ink">{row.label}</span>
                  <span className="text-sm text-ink-faint line-through decoration-line-strong">
                    {row.old}
                  </span>
                  <span className="text-sm font-medium text-ink">{row.next}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
