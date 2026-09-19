import type { SeoFacts } from "@/lib/scan/insights/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-ink-faint">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function SeoSnapshot({ seo }: { seo: SeoFacts | null }) {
  if (!seo) return null;

  const readability =
    seo.readability != null ? `${seo.readability}/100` : "Not enough text to score";

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">SEO snapshot</h2>
      <p className="mt-1 text-ink-soft">The on-page facts we measured, at a glance.</p>

      <dl className="mt-5 rounded-2xl border border-line bg-white px-5 py-2 sm:px-6">
        <Row
          label="Title"
          value={seo.title ? `${seo.title} (${seo.titleLength} chars)` : "Missing"}
        />
        <Row
          label="Meta description"
          value={
            seo.metaDescription
              ? `${seo.metaDescriptionLength} characters`
              : "Missing"
          }
        />
        <Row label="H1" value={seo.h1 ?? "Missing"} />
        <Row label="Word count" value={`${seo.wordCount} (~${seo.readingMinutes} min read)`} />
        <Row label="Readability" value={readability} />
        <Row label="Internal links" value={String(seo.internalLinks)} />
        <Row label="External links" value={String(seo.externalLinks)} />
        <Row label="Images with alt text" value={`${seo.imagesWithAlt} of ${seo.imagesTotal}`} />
        <Row label="Canonical" value={seo.canonical ?? "Missing"} />
        <Row label="Robots meta" value={seo.metaRobots ?? "Not set"} />
        <Row
          label="Structured data"
          value={seo.structuredDataTypes.length > 0 ? seo.structuredDataTypes.join(", ") : "None"}
        />
        <Row label="Language" value={seo.lang ?? "Not set"} />
      </dl>
    </section>
  );
}
