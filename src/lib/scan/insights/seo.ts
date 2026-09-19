import type { PageSnapshot } from "../extract";
import { readabilityLabel, readabilityScore, readingMinutes } from "./readability";
import type { ScanInsights, SeoFacts, Suggestion } from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "you",
  "your",
  "with",
  "that",
  "this",
  "from",
  "have",
  "are",
  "was",
  "were",
  "will",
  "can",
  "our",
  "their",
  "they",
  "them",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "into",
  "over",
  "more",
  "most",
  "than",
  "then",
  "also",
  "just",
  "about",
  "after",
  "before",
  "between",
  "other",
  "only",
  "some",
  "such",
  "your",
  "get",
  "got",
  "make",
  "made",
  "use",
  "using",
  "used",
  "well",
]);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter(
    (word) => word.length > 3 && !STOPWORDS.has(word),
  );
}

function firstSentence(text: string): string {
  const normalised = text.replace(/\s+/g, " ").trim();
  const match = normalised.match(/[^.!?]{40,}?[.!?]/);
  return (match ? match[0] : normalised.slice(0, 160)).trim();
}

function trimTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function brandFromUrl(finalUrl: string): string {
  try {
    const host = new URL(finalUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "Your brand";
  }
}

function topWord(text: string): { word: string; count: number; ratio: number } | null {
  const all = words(text);
  if (all.length < 40) return null;
  const counts = new Map<string, number>();
  for (const word of all) counts.set(word, (counts.get(word) ?? 0) + 1);
  let best: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (!best || count > best.count) best = { word, count };
  }
  if (!best) return null;
  return { ...best, ratio: best.count / all.length };
}

export function buildSeoFacts(snapshot: PageSnapshot): SeoFacts {
  const readability = readabilityScore(snapshot.bodyText);
  return {
    title: snapshot.title,
    titleLength: snapshot.title ? snapshot.title.length : null,
    metaDescription: snapshot.metaDescription,
    metaDescriptionLength: snapshot.metaDescription ? snapshot.metaDescription.length : null,
    h1: snapshot.h1Texts[0] ?? null,
    wordCount: snapshot.wordCount,
    readingMinutes: readingMinutes(snapshot.wordCount),
    readability,
    internalLinks: snapshot.internalLinkCount,
    externalLinks: snapshot.externalLinkCount,
    imagesTotal: snapshot.imageCount,
    imagesWithAlt: snapshot.imageCount - snapshot.imagesMissingAlt,
    canonical: snapshot.canonical,
    metaRobots: snapshot.metaRobots,
    structuredDataTypes: snapshot.jsonLd.types,
    lang: snapshot.lang,
  };
}

export function buildSeoSuggestions(snapshot: PageSnapshot): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const brand = brandFromUrl(snapshot.finalUrl);
  const h1 = snapshot.h1Texts[0] ?? null;
  const readability = readabilityScore(snapshot.bodyText);

  // 1. Meta description draft.
  if (!snapshot.metaDescription || snapshot.metaDescription.length < 70) {
    const lead = h1 ?? snapshot.title ?? "What this page offers";
    let body = firstSentence(snapshot.bodyText);
    // structuredText includes the heading, so strip a leading duplicate.
    const leadLower = lead.toLowerCase();
    while (body.toLowerCase().startsWith(leadLower)) {
      body = body.slice(lead.length).replace(/^[\s.:—–-]+/, "");
    }
    const draft = trimTo(body ? `${lead}. ${body}` : `${lead}.`, 155);
    suggestions.push({
      id: "seo.meta-description-draft",
      category: "SEO",
      title: "Use this meta description draft",
      detail:
        "We drafted a description from your page's heading and opening sentence. Edit it to match your voice, keep it under 155 characters, and make it unique per page.",
      example: { label: "Suggested meta description", value: draft, language: "html" },
      impact: "medium",
      effort: "low",
    });
  }

  // 2. Title topic alignment.
  const h1Words = h1 ? words(h1) : [];
  const titleLower = (snapshot.title ?? "").toLowerCase();
  const missingTitleWords = h1Words.filter((word) => !titleLower.includes(word));
  if (h1 && (!snapshot.title || missingTitleWords.length > 0)) {
    suggestions.push({
      id: "seo.title-topic",
      category: "SEO",
      title: "Put the page topic in the title",
      detail: snapshot.title
        ? `The title does not mention the main idea of your H1 (“${h1}”). Work the topic into the first half of the title so it is not truncated.`
        : `Add a title built around your H1 (“${h1}”) plus the brand.`,
      example: { label: "Suggested title", value: `${h1} | ${brand}`, language: "html" },
      impact: "medium",
      effort: "low",
    });
  }

  // 3. Internal linking.
  if (snapshot.internalLinkCount < 5 && snapshot.linkCount > 0) {
    suggestions.push({
      id: "seo.internal-links",
      category: "SEO",
      title: "Add internal links to related pages",
      detail: `We found only ${snapshot.internalLinkCount} internal link(s). Link to related pages and key sections with descriptive anchor text to spread authority and keep visitors on the site.`,
      impact: "medium",
      effort: "low",
    });
  }

  // 4. Content depth.
  if (snapshot.wordCount < 600) {
    suggestions.push({
      id: "seo.content-depth",
      category: "Content",
      title: "Expand the page to cover the topic properly",
      detail: `The page has about ${snapshot.wordCount} words. Adding sections that answer the questions a visitor would ask (with H2/H3 headings) helps search engines understand the topic and keeps people reading.`,
      impact: "medium",
      effort: "medium",
    });
  }

  // 5. Structured data opportunity.
  const types = snapshot.jsonLd.types;
  const hasFaq = types.some((type) => /FAQPage/i.test(type));
  const hasOrg = types.some((type) => /Organization|LocalBusiness/i.test(type));
  const hasArticle = types.some((type) => /Article|BlogPosting|NewsArticle/i.test(type));
  const questionHeadings = snapshot.headings.filter((heading) => heading.text.trim().endsWith("?"));
  if (questionHeadings.length >= 2 && !hasFaq) {
    suggestions.push({
      id: "seo.faq-schema",
      category: "SEO",
      title: "Add FAQ structured data for your question headings",
      detail: `You have ${questionHeadings.length} question-style headings. Marking them up as FAQPage can earn expanded results in search.`,
      example: {
        label: "FAQ schema starter",
        value:
          '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Your question?","acceptedAnswer":{"@type":"Answer","text":"Your answer."}}]}',
        language: "json",
      },
      impact: "medium",
      effort: "medium",
    });
  } else if (!hasOrg) {
    suggestions.push({
      id: "seo.organization-schema",
      category: "SEO",
      title: "Add Organization structured data",
      detail:
        "Describe your company with Organization JSON-LD (name, logo, URL, sameAs profiles). It helps search engines build knowledge-panel information about you.",
      example: {
        label: "Organization schema starter",
        value:
          '{"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://example.com","logo":"https://example.com/logo.png"}',
        language: "json",
      },
      impact: "low",
      effort: "medium",
    });
  } else if (snapshot.wordCount > 800 && !hasArticle && h1) {
    suggestions.push({
      id: "seo.article-schema",
      category: "SEO",
      title: "Mark up long-form content as Article",
      detail:
        "This is a long page. Article (or BlogPosting) structured data helps search engines date and attribute your content.",
      impact: "low",
      effort: "medium",
    });
  }

  // 6. URL structure.
  try {
    const { pathname } = new URL(snapshot.finalUrl);
    const problems: string[] = [];
    if (pathname.includes("_")) problems.push("underscores instead of hyphens");
    if (/[A-Z]/.test(pathname)) problems.push("uppercase letters");
    if (pathname.length > 75) problems.push("a very long path");
    if (problems.length > 0) {
      suggestions.push({
        id: "seo.url-structure",
        category: "SEO",
        title: "Clean up the URL structure",
        detail: `The URL uses ${problems.join(" and ")}. Short, lowercase, hyphen-separated paths are easier to read and share.`,
        example: {
          label: "Preferred",
          value: "/running-shoes-guide",
          language: "text",
        },
        impact: "low",
        effort: "medium",
      });
    }
  } catch {
    // Ignore malformed URLs.
  }

  // 7. Readability.
  if (readability !== null && readability < 45) {
    suggestions.push({
      id: "seo.readability",
      category: "Content",
      title: "Make the copy easier to read",
      detail: `The readability score is ${readability}/100 (${readabilityLabel(readability)}). Shorter sentences and simpler words help more visitors finish the page.`,
      impact: "medium",
      effort: "medium",
    });
  }

  // 8. Keyword repetition.
  const repeated = topWord(snapshot.bodyText);
  if (repeated && repeated.ratio > 0.07 && repeated.count >= 10) {
    suggestions.push({
      id: "seo.keyword-repetition",
      category: "SEO",
      title: "Vary repeated wording",
      detail: `“${repeated.word}” appears ${repeated.count} times. Repeating one term this often reads as keyword stuffing; use synonyms and natural phrasing.`,
      impact: "low",
      effort: "low",
    });
  }

  // 9. Image filenames.
  if (snapshot.genericImageFilenames > 0) {
    suggestions.push({
      id: "seo.image-filenames",
      category: "SEO",
      title: "Use descriptive image filenames",
      detail: `${snapshot.genericImageFilenames} image(s) use generic names like IMG_1234.jpg. Descriptive, hyphenated filenames are a small but free relevance signal.`,
      example: { label: "Example", value: "red-running-shoes.webp", language: "text" },
      impact: "low",
      effort: "low",
    });
  }

  // 10. Outbound citations.
  if (snapshot.externalLinkCount === 0 && snapshot.wordCount >= 800) {
    suggestions.push({
      id: "seo.outbound-sources",
      category: "SEO",
      title: "Cite reputable sources",
      detail:
        "This is a substantial page with no outbound links. Linking to authoritative sources supports E-E-A-T and gives readers more to trust.",
      impact: "low",
      effort: "low",
    });
  }

  return suggestions;
}

export function buildWebsiteInsights(snapshot: PageSnapshot): ScanInsights {
  return {
    suggestions: buildSeoSuggestions(snapshot),
    seo: buildSeoFacts(snapshot),
  };
}
