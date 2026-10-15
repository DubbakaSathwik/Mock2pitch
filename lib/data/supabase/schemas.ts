// Zod schemas for every backend response the adapter consumes. Shape drift fails loudly in development and is reported
// safely (code only, no payload) in production. Row schemas are `passthrough` so additive columns never break the UI.
import { z } from "zod";
import { AppError } from "../errors";

const num = z.union([z.number(), z.string().transform((s) => Number(s))]).pipe(z.number());
const nnum = num.nullable();
const iso = z.string();
const strArr = z.array(z.string());

export const profileRow = z.object({
  id: z.string(), email: z.string(), full_name: z.string().nullable(), avatar_url: z.string().nullable(), college: z.string().nullable(), year: z.string().nullable(),
  branch: z.string().nullable(), profile_completed_at: z.string().nullable(), role: z.string(), is_blocked: z.boolean(), blocked_at: z.string().nullable(),
  deletion_requested_at: z.string().nullable(), last_active_at: z.string().nullable(), created_at: iso, updated_at: iso,
}).passthrough();
export const policyRow = z.object({ id: z.string(), version_label: z.string(), terms_body: z.string(), privacy_body: z.string(), note: z.string().nullable(), published_at: iso, published_by: z.string().nullable() }).passthrough();
export const deckRow = z.object({
  id: z.string(), owner_id: z.string(), title: z.string(), original_filename: z.string(), page_count: nnum, status: z.string(), processing_stage: z.string().nullable(),
  processed_slides: num, error_code: z.string().nullable(), pinned_at: z.string().nullable(), created_at: iso, updated_at: iso,
}).passthrough();
export const slideRow = z.object({
  id: z.string(), deck_id: z.string(), slide_index: num, title: z.string().nullable(), extracted_text: z.string().nullable(), key_points: strArr, suggested_script: z.string().nullable(),
  time_weight: num, image_file_id: z.string().nullable(), created_at: iso, updated_at: iso,
}).passthrough();
export const sessionRow = z.object({
  id: z.string(), deck_id: z.string(), owner_id: z.string(), attempt_number: num, total_minutes: num, suggested_seconds: z.array(num), status: z.string(), analysis_stage: z.string().nullable(),
  error_code: z.string().nullable(), analysis_attempts: num, policy_version_id: z.string().nullable(), created_at: iso, submitted_at: z.string().nullable(), completed_at: z.string().nullable(), updated_at: iso,
}).passthrough();
export const reportRow = z.object({
  id: z.string(), session_id: z.string(), owner_id: z.string(), deck_id: z.string(), attempt_number: num, overall_score: num, coverage_score: num, clarity_score: num, timing_score: num,
  filler_score: num, overall_wpm: nnum, total_duration_ms: nnum, key_points_covered: nnum, key_points_total: nnum, filler_total: nnum, headline: z.string(), top_fixes: strArr, did_well: strArr,
  delta_from_first: nnum, first_attempt_score: nnum, scoring_version: z.string(), models: z.unknown().nullable(), created_at: iso,
}).passthrough();
export const ratingRow = z.object({ id: z.string(), report_id: z.string(), user_id: z.string(), stars: num, comment: z.string().nullable(), created_at: iso }).passthrough();

const fillers = z.array(z.object({ word: z.string(), count: num })).nullable().transform((v) => v ?? []);
const wordTimings = z.array(z.object({ w: z.string(), start_ms: num, end_ms: num })).nullable().transform((v) => v ?? []);
export const resultRow = z.object({
  session_id: z.string(), slide_index: num, duration_ms: num, suggested_seconds: num, word_count: nnum, wpm: nnum, transcript: z.string().nullable(), word_timings: wordTimings,
  filler_count: nnum, fillers, key_points_covered: z.array(num).nullable(), key_points_missed: z.array(num).nullable(), off_topic_quotes: strArr.nullable(), slide_feedback: z.string().nullable(),
}).passthrough();

// ---- RPC outputs
export const dashboardStats = z.object({
  sessions_used_today: num, daily_limit: num, next_reset_at: z.string(), attempts_count: num, average_score: nnum, best_score: nnum, total_practice_ms: num, total_key_points_covered: num,
}).passthrough();
export const deckSummary = z.object({
  deck_id: z.string(), title: z.string(), page_count: num, pinned: z.boolean(), pinned_at: z.string().nullable(), created_at: iso, attempts_count: num, latest_score: nnum, latest_attempt_at: z.string().nullable(),
}).passthrough();
export const deckAttempt = z.object({
  report_id: z.string(), session_id: z.string(), attempt_number: num, created_at: iso, overall_score: num, coverage_score: num, clarity_score: num, timing_score: num, filler_score: num, overall_wpm: nnum, delta_from_first: nnum,
}).passthrough();
export const recentReport = z.object({ id: z.string(), deck_id: z.string(), overall_score: num, attempt_number: num, created_at: iso, decks: z.object({ title: z.string() }).nullable() }).passthrough();

// ---- Edge Function payloads
export const signedUpload = z.object({ url: z.string(), method: z.literal("PUT"), headers: z.record(z.string(), z.string()), expires_at: z.string() });
export const uploadInit = z.object({ deck_id: z.string(), upload: signedUpload }).passthrough();
export const uploadComplete = z.object({
  deck_id: z.string(), page_count: num, images: z.array(z.object({ slide_index: num, upload: signedUpload })),
  rules: z.object({ max_width: num, min_width: num, jpeg_quality: num, min_jpeg_quality: num, max_bytes: num, content_type: z.literal("image/jpeg") }),
}).passthrough();
export const processResult = z.object({ deck_id: z.string(), status: z.enum(["processing", "ready"]) }).passthrough();
export const assetUrls = z.object({ deck_id: z.string(), expires_at: z.string(), files: z.array(z.object({ kind: z.enum(["slide_image", "deck_pdf"]), slide_index: num.nullable(), url: z.string() })) }).passthrough();
export const submitInit = z.object({ session_id: z.string(), clips: z.array(z.object({ slide_index: num, upload: signedUpload })) }).passthrough();
export const analyseResult = z.object({ session_id: z.string(), status: z.enum(["transcribing", "completed"]), report_id: z.string().optional() }).passthrough();
export const accountDelete = z.object({ deleted: z.literal(true), storage_cleanup: z.enum(["complete", "pending"]) }).passthrough();
export const adminAiKeys = z.object({ purposes: z.array(z.object({ purpose: z.string(), model: z.string(), slots: z.array(z.object({ slot_id: z.string(), slot: z.string(), configured: z.boolean(), masked: z.string() })) })) }).passthrough();

// ---- admin RPCs
export const adminOverview = z.object({ total_students: num, sessions_last_14_days: num, sessions_all_time: num, average_rating: nnum, ratings_count: num, ai_credits_used: num }).passthrough();
export const sessionsPerDay = z.object({ day: z.string(), count: num });
export const adminStudent = z.object({
  user_id: z.string(), full_name: z.string().nullable(), email: z.string(), college: z.string().nullable(), year: z.string().nullable(), branch: z.string().nullable(), avatar_url: z.string().nullable(),
  attempts: num, last_active_at: z.string().nullable(), average_score: nnum, is_blocked: z.boolean(), total_count: num,
}).passthrough();
export const adminStudentDetail = z.object({
  profile: z.object({ user_id: z.string(), full_name: z.string().nullable(), email: z.string(), college: z.string().nullable(), year: z.string().nullable(), branch: z.string().nullable(), avatar_url: z.string().nullable(), is_blocked: z.boolean(), last_active_at: z.string().nullable(), created_at: iso }),
  attempts: z.array(z.object({ report_id: z.string(), deck_title: z.string(), attempt_number: num, date: iso, overall_score: num })),
  ratings: z.array(z.object({ deck_title: z.string(), stars: num, comment: z.string().nullable(), date: iso })),
}).passthrough();
export const adminRatings = z.object({
  average: nnum, count: num,
  rows: z.array(z.object({ student_name: z.string(), user_id: z.string(), deck_title: z.string(), stars: num, comment: z.string().nullable(), date: iso })),
}).passthrough();
export const adminAiUsage = z.object({
  purposes: z.array(z.object({
    purpose: z.string(),
    slots: z.array(z.object({ slot_id: z.string(), slot: z.string(), credit_limit: num, used: num, remaining: num, percent_used: num, running_low: z.boolean(), cooldown_until: z.string().nullable(), last_error_code: z.string().nullable() })).nullable().transform((v) => v ?? []),
    per_day: z.array(z.object({ date: z.string(), count: num })).nullable().transform((v) => v ?? []),
  })),
}).passthrough();
export const adminPolicyVersion = z.object({
  id: z.string(), version_label: z.string(), note: z.string().nullable(), published_at: iso, published_by: z.string().nullable(), is_live: z.boolean(), terms_body: z.string(), privacy_body: z.string(),
}).passthrough();

/** Parses a backend payload. Development: throws with the Zod issues (drift is a bug). Production: an AppError("unknown") and a code-only log line. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, label: string): z.output<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  if (process.env.NODE_ENV !== "production") throw new Error(`Backend response for ${label} does not match its schema: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  console.error(JSON.stringify({ level: "error", msg: "response_shape_mismatch", label, issues: r.error.issues.length }));
  throw new AppError("unknown", undefined, { label });
}
