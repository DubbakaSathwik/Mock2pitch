import { describe, expect, it } from "vitest";
import {
  computeScores, countFillers, countWords, coverageScore, fillerScore, overallScore, suggestedSeconds, timingScore, wpm,
} from "@shared/scoring.ts";

describe("timingScore", () => {
  const target = 100_000;
  it("is 100 within 5%", () => {
    expect(timingScore(100_000, target)).toBe(100);
    expect(timingScore(105_000, target)).toBe(100);
    expect(timingScore(95_000, target)).toBe(100);
  });
  it("falls linearly to 0 at 50%", () => {
    expect(timingScore(127_500, target)).toBe(50); // d=0.275 -> midpoint
    expect(timingScore(150_000, target)).toBe(0);
    expect(timingScore(300_000, target)).toBe(0);
    expect(timingScore(10_000, target)).toBe(0);
  });
  it("handles zero target", () => expect(timingScore(1000, 0)).toBe(0));
});

describe("fillerScore", () => {
  it("100 with no fillers", () => expect(fillerScore(0, 120_000)).toBe(100));
  it("15 points per filler/min", () => expect(fillerScore(2, 120_000)).toBe(85)); // fpm=1
  it("floors at 0 beyond 6.67/min", () => {
    expect(fillerScore(14, 120_000)).toBe(0); // fpm 7
    expect(fillerScore(100, 60_000)).toBe(0);
  });
  it("uses a 0.5 min floor for very short talks", () => expect(fillerScore(1, 5_000)).toBe(70)); // fpm = 2
});

describe("coverageScore / overall", () => {
  it("covers 0/partial/full", () => {
    expect(coverageScore(0, 10)).toBe(0);
    expect(coverageScore(7, 10)).toBe(70);
    expect(coverageScore(10, 10)).toBe(100);
    expect(coverageScore(0, 0)).toBe(0);
  });
  it("applies 35/25/20/20 weights and rounds", () => {
    expect(overallScore({ coverage: 100, clarity: 100, timing: 100, fillers: 100 })).toBe(100);
    expect(overallScore({ coverage: 80, clarity: 60, timing: 50, fillers: 40 })).toBe(Math.round(28 + 15 + 10 + 8));
    expect(overallScore({ coverage: 0, clarity: 0, timing: 0, fillers: 0 })).toBe(0);
  });
});

describe("computeScores", () => {
  const slides = [
    { slideIndex: 0, keyPointCount: 3, recorded: true, coveredIdx: [0, 1, 1, 9], suggestedSeconds: 60, durationMs: 60_000, transcript: "um so basically we like built it" },
    { slideIndex: 1, keyPointCount: 2, recorded: false, coveredIdx: [0, 1], suggestedSeconds: 60, durationMs: 0, transcript: "" },
  ];
  it("counts unrecorded slides' key points as missed and ignores their covered list", () => {
    const r = computeScores(slides, 80, null);
    expect(r.keyPointsTotal).toBe(5);
    expect(r.keyPointsCovered).toBe(3); // set of {0,1,9} -> caller validates idx; set semantics dedupe the repeat
    expect(r.deltaFromFirst).toBeNull();
  });
  it("WPM is informational only", () => {
    const a = computeScores(slides, 80, null);
    const b = computeScores([{ ...slides[0]!, transcript: slides[0]!.transcript + " " + "word ".repeat(500) }, slides[1]!], 80, null);
    expect(a.overallWpm).not.toBeNull();
    expect(b.overallWpm).toBeGreaterThan(a.overallWpm!);
  });
  it("delta from first attempt", () => expect(computeScores(slides, 80, 50).deltaFromFirst).toBe(computeScores(slides, 80, 50).overall - 50));
  it("clamps clarity", () => expect(computeScores(slides, 150, null).clarity).toBe(100));
});

describe("fillers", () => {
  it("matches whole words only, case-insensitively", () => {
    expect(countFillers("Um, we LIKE it. Basically, you know, actually fine.").total).toBe(5);
    expect(countFillers("an umbrella is likely actually-ish").fillers.map((f) => f.word)).toEqual(["actually"]);
    expect(countFillers("unlikely umpire").total).toBe(0);
    expect(countFillers("buzz humming dislike").total).toBe(0);
  });
  it("counts 'you know' as one multi-word filler", () => {
    const r = countFillers("you know you know");
    expect(r).toEqual({ total: 2, fillers: [{ word: "you know", count: 2 }] });
  });
});

describe("misc", () => {
  it("suggestedSeconds splits proportionally", () => {
    expect(suggestedSeconds(5, [10, 20, 20])).toEqual([60, 120, 120]);
    const s = suggestedSeconds(7, [1, 1, 1]);
    expect(Math.abs(s.reduce((a, b) => a + b, 0) - 420)).toBeLessThanOrEqual(2);
    expect(suggestedSeconds(5, [0, 0])).toEqual([0, 0]);
  });
  it("words and wpm", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  a  b c ")).toBe(3);
    expect(wpm(150, 60_000)).toBe(150);
    expect(wpm(10, 0)).toBeNull();
  });
});
