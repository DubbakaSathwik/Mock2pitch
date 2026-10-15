// Deterministic stand-ins for the AI steps (key points / script, transcript, report text). Scores use the REAL scoring functions.
import { computeScores, countFillers, countWords, wpm as calcWpm } from "@shared/scoring.ts";
import { mmss } from "@/lib/format";
import type { ReportRow, SessionRow, SlideRow } from "../types";
import type { ResultRow } from "./state";

export function hashString(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed: string) { let a = hashString(seed); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** What "the AI reads the slide" produces in mock mode, from the text pdf.js found on the page. */
export function readSlideFromText(text: string | null, index: number): { title: string; extracted_text: string; key_points: string[]; script: string; weight: number } {
  const lines = (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] ?? `Slide ${index + 1}`).slice(0, 120);
  const body = lines.slice(1);
  const generic = ["Introduce this slide in one sentence", "Explain the main idea in your own words", "Link it to the next slide"];
  const kp = body.slice(0, 5).map((l) => l.replace(/^[•\-*\d.)\s]+/, "").slice(0, 120)).filter(Boolean);
  while (kp.length < 3) kp.push(generic[kp.length]!);
  const script = body.length ? `${title}. ${body.slice(0, 5).map((b) => b.replace(/^[•\-*\d.)\s]+/, "")).join(". ")}.` : `${title}. Explain the main idea of this slide in your own words.`;
  const weight = Math.max(10, Math.min(60, Math.round(10 + body.join(" ").length / 8)));
  return { title, extracted_text: lines.join("\n"), key_points: kp, script: script.slice(0, 1500), weight };
}

function transcriptFor(slide: SlideRow, durationMs: number, r: () => number): { text: string; words: { w: string; start_ms: number; end_ms: number }[] } {
  const source = (slide.suggested_script ?? slide.title ?? "").split(/\s+/).filter(Boolean);
  const fallback = "so this slide explains the main idea and how it connects to the rest of our pitch".split(" ");
  const base = source.length >= 6 ? source : fallback;
  const target = Math.max(4, Math.round((durationMs / 60000) * (140 + r() * 40)));
  const out: string[] = [];
  const fillers = ["um", "basically", "like", "actually", "you know", "uh"];
  for (let i = 0; out.length < target; i++) {
    out.push(base[i % base.length]!);
    if (out.length > 3 && r() < 0.07) out.push(fillers[Math.floor(r() * fillers.length)]!);
  }
  const text = out.join(" ").replace(/\s+/g, " ").trim().replace(/(^.)/, (c) => c.toUpperCase()) + ".";
  const words = text.split(/\s+/).map((w, i, arr) => ({ w, start_ms: Math.round((durationMs * i) / arr.length), end_ms: Math.round((durationMs * (i + 0.9)) / arr.length) }));
  return { text, words };
}

export type ClipInfo = { slide_index: number; durationMs: number };

/** The "transcribe + analyse" result. Also used to build the Phase-1-shaped report row. */
export function generateAnalysis(a: { session: SessionRow; slides: SlideRow[]; clips: ClipInfo[]; firstAttemptScore: number | null; reportId: string; createdAt: string }): { report: ReportRow; results: ResultRow[] } {
  const { session, slides, clips } = a;
  const results: ResultRow[] = [];
  const inputs: Parameters<typeof computeScores>[0] = [];
  const clipFor = new Map(clips.map((c) => [c.slide_index, c]));
  for (const s of slides) {
    const clip = clipFor.get(s.slide_index);
    const sug = session.suggested_seconds[s.slide_index] ?? 0;
    if (!clip) {
      results.push({ session_id: session.id, slide_index: s.slide_index, duration_ms: 0, suggested_seconds: sug, word_count: 0, wpm: null, transcript: null, word_timings: [], filler_count: 0, fillers: [], key_points_covered: [], key_points_missed: s.key_points.map((_, i) => i), off_topic_quotes: [], slide_feedback: null });
      inputs.push({ slideIndex: s.slide_index, keyPointCount: s.key_points.length, recorded: false, coveredIdx: [], suggestedSeconds: sug, durationMs: 0, transcript: "" });
      continue;
    }
    const r = rng(`${session.id}:${s.slide_index}`);
    const t = transcriptFor(s, clip.durationMs, r);
    const quick = clip.durationMs < sug * 1000 * 0.25;
    const covered = s.key_points.map((_, i) => i).filter(() => r() < (quick ? 0.35 : 0.8));
    const missed = s.key_points.map((_, i) => i).filter((i) => !covered.includes(i));
    const f = countFillers(t.text); const wc = countWords(t.text);
    const off = r() < 0.25 ? [`${t.text.split(" ").slice(2, 9).join(" ")}.`] : [];
    results.push({ session_id: session.id, slide_index: s.slide_index, duration_ms: clip.durationMs, suggested_seconds: sug, word_count: wc, wpm: calcWpm(wc, clip.durationMs), transcript: t.text, word_timings: t.words, filler_count: f.total, fillers: f.fillers, key_points_covered: covered, key_points_missed: missed, off_topic_quotes: off, slide_feedback: missed.length ? `Add: ${missed.map((i) => `"${s.key_points[i]}"`).join(", ")}.` : "Every key point was covered." });
    inputs.push({ slideIndex: s.slide_index, keyPointCount: s.key_points.length, recorded: true, coveredIdx: covered, suggestedSeconds: sug, durationMs: clip.durationMs, transcript: t.text });
  }
  const clarity = 58 + Math.floor(rng(`${session.id}:clarity`)() * 32);
  const sc = computeScores(inputs, clarity, a.firstAttemptScore);
  const targetS = session.suggested_seconds.reduce((x, y) => x + y, 0);
  const tone = sc.overall >= 75 ? "Clear and confident. Keep refining the details." : sc.overall >= 60 ? "A solid run. Tighten the timing and cover every key point." : "A good start. Slow down and cover each key point.";
  const fixes = [
    `You spoke at ${Math.round(sc.overallWpm ?? 0)} wpm overall. Pause after each key point.`,
    sc.fillerTotal ? `You used ${sc.fillerTotal} filler ${sc.fillerTotal === 1 ? "word" : "words"}. Try a short pause instead.` : "Keep avoiding filler words. Nicely done.",
    `You covered ${sc.keyPointsCovered} of ${sc.keyPointsTotal} key points. Cover the missed ones first next time.`,
  ];
  const well = [
    `Your total time was ${mmss(sc.totalDurationMs / 1000)} against a ${mmss(targetS)} target.`,
    `You covered ${sc.keyPointsCovered} of ${sc.keyPointsTotal} key points.`,
    "Your sentences were complete, with few restarts.",
  ];
  const report: ReportRow = {
    id: a.reportId, session_id: session.id, owner_id: session.owner_id, deck_id: session.deck_id, attempt_number: session.attempt_number,
    overall_score: sc.overall, coverage_score: sc.coverage, clarity_score: sc.clarity, timing_score: sc.timing, filler_score: sc.fillers,
    overall_wpm: sc.overallWpm, total_duration_ms: sc.totalDurationMs, key_points_covered: sc.keyPointsCovered, key_points_total: sc.keyPointsTotal, filler_total: sc.fillerTotal,
    headline: tone, top_fixes: fixes, did_well: well, delta_from_first: sc.deltaFromFirst, first_attempt_score: a.firstAttemptScore, scoring_version: "v1", models: null, created_at: a.createdAt,
  };
  return { report, results };
}
