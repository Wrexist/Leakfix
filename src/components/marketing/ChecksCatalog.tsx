import { CHECKS_BY_CATEGORY, TOTAL_CHECKS } from "@/lib/scan/catalog";

import { Reveal } from "../motion/Reveal";

export function ChecksCatalog() {
  return (
    <section id="checks" className="mx-auto w-full scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-sm font-semibold tracking-wide text-brand">What we check</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          {TOTAL_CHECKS} real checks. No fluff, no fake scores.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Every check is a real measurement on the page you submit. If we did not detect it, you will
          not see it. Here is exactly what runs.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {CHECKS_BY_CATEGORY.map((entry, index) => (
          <Reveal key={entry.category} delay={index * 0.05} className="min-w-0">
            <div className="h-full rounded-2xl border border-line bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-ink">{entry.label}</h3>
                <span className="font-mono text-sm font-semibold text-brand">{entry.count}</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {entry.checks.map((check) => (
                  <li
                    key={check}
                    className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-soft"
                  >
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
