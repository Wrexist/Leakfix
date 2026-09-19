import type { Category, Effort, Impact } from "../types";

export interface SuggestionExample {
  label: string;
  value: string;
  language?: "html" | "text" | "json";
}

export interface Suggestion {
  id: string;
  category: Category;
  title: string;
  detail: string;
  example?: SuggestionExample;
  impact: Impact;
  effort: Effort;
}

export interface SeoFacts {
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  h1: string | null;
  wordCount: number;
  readingMinutes: number;
  readability: number | null;
  internalLinks: number;
  externalLinks: number;
  imagesTotal: number;
  imagesWithAlt: number;
  canonical: string | null;
  metaRobots: string | null;
  structuredDataTypes: string[];
  lang: string | null;
}

export interface ScanInsights {
  suggestions: Suggestion[];
  seo: SeoFacts | null;
}
