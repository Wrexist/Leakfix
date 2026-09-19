import { Reveal } from "../motion/Reveal";

const FAQ = [
  {
    q: "Is this really free?",
    a: "Yes. Running a scan and reading the full report is free and needs no account. There is nothing hidden behind a signup wall.",
  },
  {
    q: "Do you change my website?",
    a: "No. Scans are completely read-only. We fetch your public page the same way a search engine would, and we never modify anything.",
  },
  {
    q: "How accurate is the score?",
    a: "The score is a transparent heuristic: every scan starts at 100 and each finding subtracts a fixed amount by severity. It is not a measure of revenue, traffic, or conversion loss, and we never pretend it is.",
  },
  {
    q: "Do you run JavaScript?",
    a: "Not yet. LeakFix analyzes the HTML your server returns. That covers metadata, structure, security headers, accessibility markup, and more — but a handful of issues that only appear after JavaScript runs are not covered today.",
  },
  {
    q: "Why can't you measure things like layout shift or contrast?",
    a: "Those require rendering the page in a real browser. Rather than fake them, we leave them out and label our performance findings as static heuristics, so you always know what is measured and what is estimated.",
  },
  {
    q: "What happens to my scan?",
    a: "We store the scan and its findings so you can reopen the report. We do not publish your scans or sell your data.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          Questions, answered straight.
        </h2>
      </Reveal>

      <div className="mt-8 border-y border-line">
        {FAQ.map((item, index) => (
          <Reveal key={item.q} delay={index * 0.04} className="border-b border-line last:border-b-0">
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-transform duration-200 group-open:rotate-45"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
