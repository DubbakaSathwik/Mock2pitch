// Pure, deterministic scoring and metrics (scoring_version v1). No I/O.
import {
  FILLER_MIN_MINUTES, FILLER_PENALTY_PER_MIN, FILLER_REGEX_SOURCE, TIMING_FULL_SCORE_BELOW, TIMING_ZERO_AT, WEIGHTS,
} from "./constants.ts";

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** suggested_seconds[i] = round(total*60 * weight_i / sum(weights)). Mirrors the SQL in start_practice_session. */
export function suggestedSeconds(totalMinutes: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  return weights.map((w) => Math.round((totalMinutes * 60 * w) / sum));
}

export type FillerCount = { word: string; count: number };

/** Count fillers with word-boundary-safe matching; "you know" counts as one filler. */
export function countFillers(transcript: string): { total: number; fillers: FillerCount[] } {
  const re = new RegExp(FILLER_REGEX_SOURCE, "gi");
  const map = new Map<string, number>();
  for (const m of transcript.matchAll(re)) {
    const w = (m[1] ?? "").toLowerCase();
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  const fillers = [...map.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return { total: fillers.reduce((a, f) => a + f.count, 0), fillers };
}

export function countWords(transcript: string): number {
  const t = transcript.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** Informational only (D10): never scored. */
export function wpm(words: number, durationMs: number): number | null {
  if (durationMs <= 0) return null;
  return Math.round((words / (durationMs / 60000)) * 10) / 10;
}

export function coverageScore(covered: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round((100 * covered) / total), 0, 100);
}

export function timingScore(actualMs: number, targetMs: number): number {
  if (targetMs <= 0) return 0;
  const d = Math.abs(actualMs - targetMs) / targetMs;
  if (d <= TIMING_FULL_SCORE_BELOW) return 100;
  if (d >= TIMING_ZERO_AT) return 0;
  return clamp(Math.round(100 * (1 - (d - TIMING_FULL_SCORE_BELOW) / (TIMING_ZERO_AT - TIMING_FULL_SCORE_BELOW))), 0, 100);
}

export function fillerScore(fillerTotal: number, actualMs: number): number {
  const minutes = Math.max(actualMs / 60000, FILLER_MIN_MINUTES);
  const fpm = fillerTotal / minutes;
  return clamp(Math.round(100 - FILLER_PENALTY_PER_MIN * fpm), 0, 100);
}

export function overallScore(s: { coverage: number; clarity: number; timing: number; fillers: number }): number {
  return clamp(
    Math.round(WEIGHTS.coverage * s.coverage + WEIGHTS.clarity * s.clarity + WEIGHTS.timing * s.timing + WEIGHTS.fillers * s.fillers),
    0, 100,
  );
}

export type SlideInput = {
  slideIndex: number;
  keyPointCount: number;
  recorded: boolean;
  coveredIdx: number[]; // already validated indexes
  suggestedSeconds: number;
  durationMs: number;
  transcript: string;
};

export function computeScores(slides: SlideInput[], clarity: number, firstAttemptScore: number | null) {
  const totalKeyPoints = slides.reduce((a, s) => a + s.keyPointCount, 0);
  const covered = slides.reduce((a, s) => a + (s.recorded ? new Set(s.coveredIdx).size : 0), 0);
  const actualMs = slides.reduce((a, s) => a + (s.recorded ? s.durationMs : 0), 0);
  const targetMs = slides.reduce((a, s) => a + s.suggestedSeconds * 1000, 0);
  const fillerTotal = slides.reduce((a, s) => a + (s.recorded ? countFillers(s.transcript).total : 0), 0);
  const words = slides.reduce((a, s) => a + (s.recorded ? countWords(s.transcript) : 0), 0);
  const parts = {
    coverage: coverageScore(covered, totalKeyPoints),
    clarity: clamp(Math.round(clarity), 0, 100),
    timing: timingScore(actualMs, targetMs),
    fillers: fillerScore(fillerTotal, actualMs),
  };
  const overall = overallScore(parts);
  return {
    ...parts, overall, overallWpm: wpm(words, actualMs), totalDurationMs: actualMs,
    keyPointsCovered: covered, keyPointsTotal: totalKeyPoints, fillerTotal,
    deltaFromFirst: firstAttemptScore === null ? null : overall - firstAttemptScore,
  };
}
