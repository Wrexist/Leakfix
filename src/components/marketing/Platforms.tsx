import { APP_CHECK_COUNT, WEBSITE_CHECK_COUNT } from "@/lib/scan/catalog";

import { Reveal } from "../motion/Reveal";

const PLATFORMS = [
  {
    name: "Websites",
    checks: WEBSITE_CHECK_COUNT,
    body: "SEO, security headers, accessibility, mobile, static performance, trust, and conversion — measured on the HTML your server returns.",
    example: "https://yourwebsite.com",
  },
  {
    name: "iPhone apps",
    checks: APP_CHECK_COUNT,
    body: "App Store listing review: name, description, screenshots, rating, update freshness, localization, and privacy link.",
    example: "apps.apple.com/us/app/id…",
  },
  {
    name: "Android apps",
    checks: APP_CHECK_COUNT,
    body: "Google Play listing review: the same store-optimization and trust checks, read from the public listing.",
    example: "play.google.com/store/apps/details?id=…",
  },
];

export function Platforms() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-sm font-semibold tracking-wide text-brand">What we review</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          One scanner for your website and your apps.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Paste a website, an App Store link, or a Google Play link. LeakFix detects what it is and
          runs the right checks.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PLATFORMS.map((platform, index) => (
          <Reveal key={platform.name} delay={index * 0.07} className="min-w-0">
            <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-ink">{platform.name}</h3>
                <span className="font-mono text-sm font-semibold text-brand">
                  {platform.checks}
                </span>
              </div>
              <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{platform.body}</p>
              <p className="mt-4 truncate font-mono text-xs text-ink-faint">{platform.example}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
