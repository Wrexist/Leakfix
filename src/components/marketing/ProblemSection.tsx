import { Reveal } from "../motion/Reveal";

const PROBLEMS = [
  {
    title: "They arrived. Then they left.",
    body: "Your ads and search results work, but the page gives visitors no obvious next step — or hides it below the fold where nobody looks.",
  },
  {
    title: "It loaded. Then it broke.",
    body: "Insecure resources get blocked, render-blocking scripts delay the page, and a missing mobile viewport turns your site into a zoomed-out mess.",
  },
  {
    title: "They wanted to trust you. They couldn't.",
    body: "No contact details, no privacy page, no reviews. In a world of scams, missing trust signals quietly send buyers to a competitor.",
  },
];

export function ProblemSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-sm font-semibold tracking-wide text-brand">The leak</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your traffic is fine. Your conversions are leaking.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Most leaks are invisible. You cannot fix what you cannot see — and every day it goes
          unnoticed, it keeps costing you.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PROBLEMS.map((problem, index) => (
          <Reveal key={problem.title} delay={index * 0.08} className="min-w-0">
            <div className="h-full rounded-2xl border border-line bg-white p-6">
              <span className="font-mono text-sm font-semibold text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{problem.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{problem.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-8 text-lg font-medium text-ink">
          Every one of these is fixable. But only if you know it exists.
        </p>
      </Reveal>
    </section>
  );
}
