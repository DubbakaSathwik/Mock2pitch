import { api, AppError, checkCanPractise, Errors, isInternal, logEvent, ok, readBody, requireUser } from "./common.ts";
import { sessionIdIn, sanitiseSlideReport } from "../schemas.ts";
import { ASR_CONCURRENCY, MAX_ANALYSIS_ATTEMPTS, SCORING_VERSION } from "../constants.ts";
import { parseWav } from "../files.ts";
import { pcmOf } from "../audio.ts";
import { computeScores, countFillers, countWords, wpm } from "../scoring.ts";
import { supabaseRouterStore } from "../ai/store.ts";
import { transcribePcm } from "../ai/asr.ts";
import { generateReport, type ReportInputSlide } from "../ai/report.ts";
import { modelFor } from "../env.ts";
import type { Deps } from "../deps.ts";

const FRESH_MS = 2 * 60 * 1000;
const HEADER_BYTES = 4095;

export const sessionAnalyse = api(async (ctx) => {
  const internal = isInternal(ctx.req, ctx.deps);
  const { deps } = ctx;
  let userId: string | null = null;
  if (!internal) {
    const a = await requireUser(ctx);
    userId = a.userId;
    await checkCanPractise(a, false, false); // admin / blocked; no policy re-check (D15)
  }
  const { session_id } = await readBody(ctx.req, sessionIdIn);

  let q = deps.admin.from("practice_sessions").select("id, owner_id, deck_id, status, analysis_attempts, updated_at").eq("id", session_id);
  if (userId) q = q.eq("owner_id", userId);
  const { data: s } = await q.maybeSingle();
  if (!s) throw Errors.notFound();

  if (s.status === "completed") {
    const { data: r } = await deps.admin.from("reports").select("id").eq("session_id", session_id).maybeSingle();
    return ok({ session_id, status: "completed", report_id: r?.id ?? null });
  }
  const age = deps.now().getTime() - new Date(s.updated_at).getTime();
  if (["transcribing", "generating_report"].includes(s.status)) {
    if (!internal && age < FRESH_MS) return ok({ session_id, status: s.status }, ctx.cors, 202);
  } else if (!["uploading_audio", "failed"].includes(s.status)) {
    throw Errors.conflict("invalid_state");
  }
  if (s.analysis_attempts >= MAX_ANALYSIS_ATTEMPTS) {
    await deps.admin.from("practice_sessions").update({ status: "failed", error_code: "max_attempts", analysis_stage: null }).eq("id", session_id);
    if (internal) return ok({ session_id, status: "failed" });
    throw Errors.conflict("max_attempts", "We couldn't analyse this session. Please practise again.");
  }

  // ---- verify the declared clips (exist, exact size, valid 16 kHz mono 16-bit WAV) ----
  const { data: clips } = await deps.admin.from("files").select("id, slide_index, object_key, expected_size_bytes, status").eq("session_id", session_id).eq("kind", "audio_clip").in("status", ["pending", "uploaded"]);
  // A clip problem found here (missing, wrong size, not a valid WAV) means the analysis never starts. `uploading_audio` counts as "analysing"
  // for the one-analysis-per-student rule, so give the slot back: the student fixes the clip and submits again (submit-init accepts in_progress).
  try {
    if (!clips || clips.length === 0) throw Errors.conflict("no_clips", "There's no audio to analyse.");
    for (const c of clips as { id: string; slide_index: number; object_key: string; expected_size_bytes: number; status: string }[]) {
      const head = await deps.r2.head(c.object_key);
      if (!head) {
        if (c.status === "uploaded") throw Errors.conflict("audio_expired", "That recording is no longer available.");
        throw Errors.badRequest("clip_missing", "A recording didn't upload.", { slide_index: c.slide_index });
      }
      if (head.size !== Number(c.expected_size_bytes)) {
        await deps.r2.delete(c.object_key).catch(() => {});
        await deps.admin.from("files").update({ status: "failed" }).eq("id", c.id);
        throw Errors.badRequest("size_mismatch", "A recording didn't match its declared size.", { slide_index: c.slide_index });
      }
      const info = parseWav(await deps.r2.getRange(c.object_key, 0, Math.min(HEADER_BYTES, head.size - 1)), head.size);
      if (!info.ok) {
        await deps.r2.delete(c.object_key).catch(() => {});
        await deps.admin.from("files").update({ status: "failed" }).eq("id", c.id);
        throw Errors.badRequest("audio_invalid", "A recording isn't in the expected audio format.", { slide_index: c.slide_index, reason: info.reason });
      }
      if (c.status === "pending") await deps.admin.from("files").update({ status: "uploaded", size_bytes: head.size, uploaded_at: deps.now().toISOString() }).eq("id", c.id);
    }
  } catch (e) {
    if (e instanceof AppError && s.status === "uploading_audio") await deps.admin.from("practice_sessions").update({ status: "in_progress" }).eq("id", session_id).eq("status", "uploading_audio");
    throw e;
  }

  const { error } = await deps.admin.from("practice_sessions").update({
    status: "transcribing", analysis_attempts: s.analysis_attempts + 1, analysis_stage: "Transcribing your recording", error_code: null,
  }).eq("id", session_id);
  if (error) throw error.code === "23505" ? Errors.conflict("analysis_in_progress", "We're still analysing another session.") : new AppError("internal", 500, "Something went wrong.");

  deps.background(runAnalysis(deps, session_id).catch((e) => failSession(deps, session_id, e)));
  return ok({ session_id, status: "transcribing" }, ctx.cors, 202);
});

async function failSession(deps: Deps, sessionId: string, e: unknown) {
  const c = (e as { code?: string })?.code;
  const code = c === "AI_BUSY" ? "ai_unavailable" : c === "bad_request" ? "audio_invalid" : c === "invalid_output" ? "report_invalid" : "analysis_failed";
  logEvent("session_analysis_failed", { session_id: sessionId, code });
  await deps.admin.from("practice_sessions").update({ status: "failed", error_code: code, analysis_stage: null }).eq("id", sessionId); // audio kept for retry
}

type Result = { slide_index: number; duration_ms: number; transcript: string | null; word_count: number; wpm: number | null; filler_count: number; fillers: unknown[] };

/** Resumable stages: transcribe (skips slides already done) -> report -> finalise -> delete audio. */
export async function runAnalysis(deps: Deps, sessionId: string): Promise<void> {
  const store = supabaseRouterStore(deps.admin);
  const { data: s } = await deps.admin.from("practice_sessions").select("id, owner_id, deck_id, attempt_number, suggested_seconds").eq("id", sessionId).single();
  const owner = s.owner_id as string;
  const { data: deck } = await deps.admin.from("decks").select("page_count").eq("id", s.deck_id).single();
  const n = deck.page_count as number;
  const { data: slides } = await deps.admin.from("slides").select("slide_index, title, key_points").eq("deck_id", s.deck_id).order("slide_index", { ascending: true });
  const { data: clips } = await deps.admin.from("files").select("id, slide_index, object_key").eq("session_id", sessionId).eq("kind", "audio_clip").eq("status", "uploaded");
  const clipBySlide = new Map<number, { id: string; object_key: string }>((clips ?? []).map((c: any) => [c.slide_index, c]));
  const suggested: number[] = s.suggested_seconds;

  // ---------------- Stage 1: transcription ----------------
  const { data: doneRows } = await deps.admin.from("session_slide_results").select("slide_index").eq("session_id", sessionId).not("transcript", "is", null);
  const done = new Set<number>((doneRows ?? []).map((r: any) => r.slide_index));
  const todo = [...clipBySlide.keys()].filter((i) => !done.has(i)).sort((a, b) => a - b);
  let finished = done.size;
  let fatal: unknown = null;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length && !fatal) {
      const i = queue.shift()!;
      try {
        const clip = clipBySlide.get(i)!;
        const bytes = await deps.r2.get(clip.object_key);
        const info = parseWav(bytes);
        if (!info.ok) throw new AppError("audio_invalid", 400);
        const pcm = pcmOf(bytes);
        const t = pcm.length === 0 ? { text: "", words: [] } : await transcribePcm(deps, store, pcm, { userId: owner, sessionId });
        const f = countFillers(t.text);
        const words = countWords(t.text);
        const { error } = await deps.admin.from("session_slide_results").upsert({
          session_id: sessionId, slide_index: i, duration_ms: info.durationMs, suggested_seconds: suggested[i] ?? 0, word_count: words,
          wpm: wpm(words, info.durationMs), transcript: t.text, word_timings: t.words.map((w) => ({ w: w.w, start_ms: w.start_ms, end_ms: w.end_ms })),
          filler_count: f.total, fillers: f.fillers,
        }, { onConflict: "session_id,slide_index" });
        if (error) throw new Error("result_write_failed");
        finished++;
        await deps.admin.from("practice_sessions").update({ analysis_stage: `Transcribed ${finished} of ${clipBySlide.size}` }).eq("id", sessionId);
      } catch (e) { fatal = e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ASR_CONCURRENCY, todo.length) }, worker));
  if (fatal) throw fatal;

  // ---------------- Stage 2: report ----------------
  await deps.admin.from("practice_sessions").update({ status: "generating_report", analysis_stage: "Writing your report" }).eq("id", sessionId);
  const { data: resRows } = await deps.admin.from("session_slide_results").select("*").eq("session_id", sessionId);
  const results = new Map<number, Result>((resRows ?? []).map((r: any) => [r.slide_index, r]));

  const inputSlides: ReportInputSlide[] = [];
  for (let i = 0; i < n; i++) {
    const sl = (slides ?? []).find((x: any) => x.slide_index === i);
    const r = results.get(i);
    inputSlides.push({
      slide_index: i, title: sl?.title ?? "", key_points: sl?.key_points ?? [], suggested_seconds: suggested[i] ?? 0,
      actual_seconds: r ? Math.round(r.duration_ms / 1000) : 0, wpm: r?.wpm == null ? null : Number(r.wpm),
      filler_counts: (r?.fillers ?? []) as { word: string; count: number }[], recorded: !!r, transcript: r?.transcript ?? "",
    });
  }
  const model = await generateReport(deps, store, inputSlides.filter((x) => x.recorded), { userId: owner, sessionId });
  const bySlide = new Map(model.slides.map((x) => [x.slide_index, x]));

  const slideInputs = [];
  const resultPayload = [];
  for (const sl of inputSlides) {
    const kp = sl.key_points.length;
    const m = bySlide.get(sl.slide_index);
    const san = m && sl.recorded && sl.transcript.trim() !== ""
      ? sanitiseSlideReport(m, kp, sl.transcript)
      : { slide_index: sl.slide_index, covered: [] as number[], missed: Array.from({ length: kp }, (_, k) => k), quotes: [] as string[], feedback: undefined as string | undefined };
    const r = results.get(sl.slide_index);
    slideInputs.push({ slideIndex: sl.slide_index, keyPointCount: kp, recorded: sl.recorded, coveredIdx: san.covered, suggestedSeconds: sl.suggested_seconds, durationMs: r?.duration_ms ?? 0, transcript: sl.transcript });
    resultPayload.push({
      slide_index: sl.slide_index, duration_ms: r?.duration_ms ?? 0, suggested_seconds: sl.suggested_seconds, word_count: r?.word_count ?? null,
      wpm: r?.wpm == null ? null : Number(r.wpm), transcript: r?.transcript ?? null, word_timings: (r as any)?.word_timings ?? null,
      filler_count: r?.filler_count ?? null, fillers: r?.fillers ?? null, key_points_covered: san.covered, key_points_missed: san.missed,
      off_topic_quotes: san.quotes, slide_feedback: san.feedback ?? null,
    });
  }

  let firstScore: number | null = null;
  if (s.attempt_number > 1) {
    const { data: first } = await deps.admin.from("reports").select("overall_score").eq("deck_id", s.deck_id).eq("attempt_number", 1).maybeSingle();
    firstScore = first?.overall_score ?? null;
  }
  const sc = computeScores(slideInputs, model.clarity_score, firstScore);
  const report = {
    overall_score: sc.overall, coverage_score: sc.coverage, clarity_score: sc.clarity, timing_score: sc.timing, filler_score: sc.fillers,
    overall_wpm: sc.overallWpm, total_duration_ms: sc.totalDurationMs, key_points_covered: sc.keyPointsCovered, key_points_total: sc.keyPointsTotal,
    filler_total: sc.fillerTotal, headline: model.headline, top_fixes: model.top_fixes, did_well: model.did_well,
    delta_from_first: sc.deltaFromFirst, first_attempt_score: firstScore, scoring_version: SCORING_VERSION,
    models: { slide_reading: modelFor(deps.env, "slide_reading"), speech_to_text: deps.env.NVIDIA_ASR_MODEL_LABEL, report_generation: modelFor(deps.env, "report_generation") },
  };
  const { error } = await deps.admin.rpc("svc_finalize_report", { p_session_id: sessionId, p_report: report, p_results: resultPayload });
  if (error) throw new Error("finalise_failed");

  // ---------------- Stage 3: delete audio (only mark deleted once R2 confirms) ----------------
  for (const c of (clips ?? []) as { id: string; object_key: string }[]) {
    try {
      await deps.r2.delete(c.object_key);
      await deps.admin.from("files").update({ status: "deleted", deleted_at: deps.now().toISOString() }).eq("id", c.id);
    } catch { /* left 'uploaded' for the sweeper */ }
  }
  logEvent("session_completed", { session_id: sessionId, slides: n });
}
