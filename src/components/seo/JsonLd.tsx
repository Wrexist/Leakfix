import { serializeJsonLd } from "@/lib/site";

/** Renders schema.org structured data as an escaped JSON-LD script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Safe: serializeJsonLd escapes "<" so the payload cannot close the script tag.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
