import type { Suggestion } from "@/lib/scan/insights/types";
import { CATEGORY_LABEL } from "@/lib/scan/types";

import { Reveal } from "../motion/Reveal";
import { CodeBlock } from "./CodeBlock";
import { ImpactEffort } from "./ImpactEffort";

export function Suggestions({
  suggestions,
  locked = false,
  lockedCount = 0,
}: {
  suggestions: Suggestion[];
  locked?: boolean;
  lockedCount?: number;
}) {
  if (locked && lockedCount > 0) {
    return (
      <section id="suggestions" className="mt-16 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Suggestions</h2>
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-line-strong bg-canvas p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-medium text-ink">
              {lockedCount} SEO {lockedCount === 1 ? "suggestion is" : "suggestions are"} locked
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Unlock the full report to see the drafts, structured-data ideas, and content
              improvements we generated from your page.
            </p>
          </div>
          <a
            href="#unlock"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Unlock full report
          </a>
        </div>
      </section>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <section id="suggestions" className="mt-16 scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Suggestions</h2>
      <p className="mt-1 max-w-2xl text-ink-soft">
        Improvements generated from your page — beyond pass/fail checks. Use them as a starting point,
        not a rulebook.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <Reveal key={suggestion.id} delay={index * 0.04} className="min-w-0">
            <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {CATEGORY_LABEL[suggestion.category]}
                </span>
                <ImpactEffort
                  impact={suggestion.impact}
                  effort={suggestion.effort}
                  quickWin={suggestion.impact !== "low" && suggestion.effort === "low"}
                />
              </div>

              <h3 className="mt-3 text-base font-semibold text-ink">{suggestion.title}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{suggestion.detail}</p>

              {suggestion.example ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {suggestion.example.label}
                  </p>
                  <CodeBlock
                    snippet={{
                      language: suggestion.example.language ?? "text",
                      code: suggestion.example.value,
                    }}
                  />
                </div>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
