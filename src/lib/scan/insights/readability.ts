const VOWEL_GROUPS = /[aeiouy]+/g;

/** Heuristic syllable counter used for readability scoring. */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;
  const trimmed = cleaned.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "");
  const groups = trimmed.match(VOWEL_GROUPS);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch Reading Ease (0–100, higher is easier). Returns null when there is not
 * enough prose to score reliably.
 */
export function readabilityScore(text: string): number | null {
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (words.length < 50) return null;

  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

export function readabilityLabel(score: number): string {
  if (score >= 70) return "easy to read";
  if (score >= 55) return "fairly readable";
  if (score >= 40) return "fairly difficult";
  return "difficult";
}
