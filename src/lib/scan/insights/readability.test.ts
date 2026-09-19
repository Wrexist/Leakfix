import { describe, expect, it } from "vitest";

import { countSyllables, readabilityScore } from "./readability";

describe("countSyllables", () => {
  it("counts simple words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("water")).toBe(2);
    expect(countSyllables("banana")).toBe(3);
    expect(countSyllables("")).toBe(0);
  });
});

describe("readabilityScore", () => {
  it("returns null for short text", () => {
    expect(readabilityScore("Too short.")).toBeNull();
  });

  it("scores simple prose higher than dense prose", () => {
    const simple = "The cat sat on the mat. ".repeat(20);
    const dense =
      "Notwithstanding the aforementioned considerations, the implementation necessitates comprehensive reevaluation. ".repeat(
        10,
      );
    const simpleScore = readabilityScore(simple);
    const denseScore = readabilityScore(dense);
    expect(simpleScore).not.toBeNull();
    expect(denseScore).not.toBeNull();
    expect(simpleScore!).toBeGreaterThan(denseScore!);
  });
});
