import Link from "next/link";

import { CUSTOMER_LOGOS, TESTIMONIALS } from "@/lib/marketing";

import { Reveal } from "../motion/Reveal";

const PRINCIPLES = [
  {
    title: "No invented statistics",
    body: "No made-up conversion lifts, no fake customer counts, no “10x revenue” claims. Every number we show is either measured on your page or a published rule.",
  },
  {
    title: "Every finding is evidence",
    body: "Each finding quotes exactly what we observed — the missing tag, the header, the count. If we did not detect it, we do not report it.",
  },
  {
    title: "Transparent scoring",
    body: "Fixed penalties by severity, published in the report. It is a heuristic, not a measure of revenue or traffic loss, and we say so.",
  },
  {
    title: "Read-only by design",
    body: "We fetch and read your public page like a search engine. We never modify your site, and no account is required.",
  },
];

export function Proof() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-sm font-semibold tracking-wide text-brand">Why it&apos;s different</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          Proof, without the theatre.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          The web is full of audit tools that pad reports and invent numbers. LeakFix is built on the
          opposite promise: show the evidence, be honest about limits, and make the fix obvious.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle, index) => (
          <Reveal key={principle.title} delay={index * 0.06} className="min-w-0">
            <div className="h-full rounded-2xl border border-line bg-white p-6">
              <h3 className="text-base font-semibold text-ink">{principle.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{principle.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {TESTIMONIALS.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((item) => (
            <Reveal key={`${item.name}-${item.company}`} className="min-w-0">
              <figure className="h-full rounded-2xl border border-line bg-white p-6">
                <blockquote className="text-ink">“{item.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-ink-faint">
                  <span className="font-semibold text-ink">{item.name}</span> · {item.role},{" "}
                  {item.company}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      ) : null}

      <Reveal delay={0.1}>
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-canvas p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-ink">Founding access</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              LeakFix is new. We publish customer stories and logos only once we have permission and
              real results — we would rather show nothing than invent proof. Want to be one of our
              first case studies?
            </p>
            {CUSTOMER_LOGOS.length > 0 ? (
              <ul className="mt-3 flex flex-wrap items-center gap-5">
                {CUSTOMER_LOGOS.map((logo) => (
                  <li key={logo.name} className="text-sm font-medium text-ink-faint">
                    {logo.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Link
            href="/#scan"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            Get your free report
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
