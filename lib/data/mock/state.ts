// In-memory state of the mock adapter and the persona seeds. Shapes mirror the database rows so the Supabase adapter is a drop-in.
import { countFillers, countWords, wpm as calcWpm } from "@shared/scoring.ts";
import type { PolicyVersionRow, ProfileRow, DeckRow, SlideRow, SessionRow, ReportRow, RatingRow, SlideResultRow, Role } from "../types";
import { AI_PER_DAY_SEED, PARKSENSE, PARKSENSE_REPORTS, PARKSENSE_TITLE, PRIVACY_V3, RATING_SEED, STUDENT_SEED, TERMS_V3 } from "./seed-content";

export const PERSONAS = ["signed_out", "new_student", "student", "returning_student", "at_limit", "blocked", "admin"] as const;
export type PersonaId = (typeof PERSONAS)[number];
export const PERSONA_LABEL: Record<PersonaId, string> = {
  signed_out: "Signed out", new_student: "New student (needs terms + profile)", student: "Student, no history", returning_student: "Returning student (2 attempts)",
  at_limit: "Student at the daily limit", blocked: "Blocked student", admin: "Owner admin",
};

export type MockUser = { id: string; email: string; fullName: string | null; avatarUrl: string | null; role: Role };
export type StudentSeed = { id: string; name: string; email: string; college: string; year: string; branch: string; attempts: number; lastActiveAt: string; avg: number | null; blocked: boolean };
export type SlotState = { slot_id: string; slot: "primary" | "fallback_1" | "fallback_2"; configured: boolean; masked: string; credit_limit: number; used: number; cooldown_until: string | null; last_error_code: string | null };
export type ResultRow = Omit<SlideResultRow, "fillers" | "word_timings"> & { fillers: { word: string; count: number }[]; word_timings: { w: string; start_ms: number; end_ms: number }[] };
export type FailPlan = { kind: "deck-process" | "session-analyse"; code: "ai_unavailable" | "report_invalid" | "processing_failed" | "analysis_failed" | "audio_invalid" } | null;

export type MockState = {
  version: 1;
  persona: PersonaId;
  signedIn: boolean;
  user: MockUser;
  profile: ProfileRow;
  policies: PolicyVersionRow[];
  acceptedPolicyIds: string[];
  decks: DeckRow[];
  slides: SlideRow[];
  sessions: SessionRow[];
  results: ResultRow[];
  reports: ReportRow[];
  ratings: RatingRow[];
  usageEvents: string[];
  uploads: Record<string, { filename: string; size: number; pageTexts: string[] | null; page_count: number | null }>;
  /** Clips declared by session-submit-init (slide_index + exact byte size). */
  clips: Record<string, { slide_index: number; size_bytes: number }[]>;
  /** Slides whose image lives in the public folder (seeded decks) instead of a blob. */
  seededImages: Record<string, string[]>;
  students: StudentSeed[];
  adminRatings: { student_name: string; user_id: string; deck_title: string; stars: number; comment: string | null; date: string }[];
  sessionsPerDay: number[];
  aiSlots: Record<"slide_reading" | "speech_to_text" | "report_generation", SlotState[]>;
  aiPerDay: Record<string, number[]>;
  aiModels: Record<string, string>;
  fail: FailPlan;
  /** Next persona used by signInWithGoogle() when signed out. */
  nextSignIn: PersonaId;
};

const NOW = () => new Date();
const iso = (d: Date) => d.toISOString();
const hoursAgo = (h: number) => iso(new Date(NOW().getTime() - h * 3_600_000));
export const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const SEED_USER_ID = "00000000-0000-4000-8000-00000000a001";
const OWNER_ID = "00000000-0000-4000-8000-00000000f001";
const DECK_ID = "00000000-0000-4000-8000-00000000d001";

function policies(): PolicyVersionRow[] {
  const mk = (n: number, label: string, at: string, note: string): PolicyVersionRow => ({ id: `00000000-0000-4000-8000-00000000009${n}`, version_label: label, terms_body: TERMS_V3, privacy_body: PRIVACY_V3, note, published_at: at, published_by: OWNER_ID });
  return [mk(1, "v1.0", "2026-04-15T09:00:00Z", "First release"), mk(2, "v2.0", "2026-06-03T09:00:00Z", "Clarified audio deletion"), mk(3, "v3.0", "2026-08-12T09:00:00Z", "Added usage limits")];
}

function blankProfile(user: MockUser, over: Partial<ProfileRow> = {}): ProfileRow {
  const t = hoursAgo(24 * 30);
  return { id: user.id, email: user.email, full_name: user.fullName, avatar_url: user.avatarUrl, college: null, year: null, branch: null, profile_completed_at: null, role: user.role, is_blocked: false, blocked_at: null, deletion_requested_at: null, last_active_at: hoursAgo(1), created_at: t, updated_at: t, ...over };
}

function aiSlots(): MockState["aiSlots"] {
  const mk = (purpose: string, specs: { configured: boolean; masked: string; limit: number; used: number; cooldown?: string | null; err?: string | null }[]): SlotState[] =>
    (["primary", "fallback_1", "fallback_2"] as const).map((slot, i) => ({
      slot_id: `${purpose}-${slot}`, slot, configured: specs[i]!.configured, masked: specs[i]!.masked, credit_limit: specs[i]!.limit, used: specs[i]!.used,
      cooldown_until: specs[i]!.cooldown ?? null, last_error_code: specs[i]!.err ?? null,
    }));
  return {
    slide_reading: mk("slide_reading", [{ configured: true, masked: "••••••••7c2e", limit: 3000, used: 1240 }, { configured: true, masked: "••••••••b310", limit: 3000, used: 120 }, { configured: false, masked: "", limit: 3000, used: 0 }]),
    speech_to_text: mk("speech_to_text", [{ configured: true, masked: "••••••••a91f", limit: 5000, used: 4100 }, { configured: true, masked: "••••••••5d27", limit: 5000, used: 300 }, { configured: false, masked: "", limit: 5000, used: 0 }]),
    report_generation: mk("report_generation", [{ configured: true, masked: "••••••••39d8", limit: 4000, used: 2870 }, { configured: true, masked: "••••••••c4e1", limit: 4000, used: 0, cooldown: new Date(NOW().getTime() + 45_000).toISOString(), err: "http_429" }, { configured: false, masked: "", limit: 4000, used: 0 }]),
  };
}

function students(): StudentSeed[] {
  const hrs = [2, 6, 28, 40, 384, 408, 456, 528, 576, 624];
  return STUDENT_SEED.map((s, i) => ({ id: `00000000-0000-4000-8000-0000000b${String(i).padStart(4, "0")}`, name: s[0], email: s[1], college: s[2], year: s[3], branch: s[4], attempts: s[5], lastActiveAt: hoursAgo(hrs[i]!), avg: s[7], blocked: i === 6 }));
}

function adminRatings(st: StudentSeed[]): MockState["adminRatings"] {
  return RATING_SEED.map((r) => ({ student_name: r[0], user_id: st.find((s) => s.name === r[0])?.id ?? OWNER_ID, deck_title: r[1], stars: r[2], comment: r[3] || null, date: r[4] }));
}

/** ParkSense with two reports (62 → 74), as in the design. */
function parksenseHistory(ownerId: string, sessionsToday: number) {
  const created = "2026-10-02T09:30:00Z";
  const deck: DeckRow = { id: DECK_ID, owner_id: ownerId, title: PARKSENSE_TITLE, original_filename: "ParkSense-pitch.pdf", page_count: 8, status: "ready", processing_stage: null, processed_slides: 8, error_code: null, pinned_at: null, created_at: created, updated_at: created };
  const slides: SlideRow[] = PARKSENSE.map((s, i) => ({ id: `${DECK_ID}-s${i}`, deck_id: DECK_ID, slide_index: i, title: s.title, extracted_text: [s.title, ...s.bullets].join("\n"), key_points: s.keyPoints, suggested_script: s.script, time_weight: s.weight, image_file_id: `seed-${i}`, created_at: created, updated_at: created }));
  const sessions: SessionRow[] = []; const results: ResultRow[] = []; const reports: ReportRow[] = [];
  const sugg = PARKSENSE.map((s) => s.weight); // 5:00 → seconds == weight (weights sum to 300)
  const dates = ["2026-10-02T09:45:00Z", "2026-10-02T14:20:00Z"];
  PARKSENSE_REPORTS.forEach((r, a) => {
    const sid = `${DECK_ID}-sess${a + 1}`;
    sessions.push({ id: sid, deck_id: DECK_ID, owner_id: ownerId, attempt_number: a + 1, total_minutes: 5, suggested_seconds: sugg, status: "completed", analysis_stage: null, error_code: null, analysis_attempts: 1, policy_version_id: null, created_at: dates[a]!, submitted_at: dates[a]!, completed_at: dates[a]!, updated_at: dates[a]! });
    let totalMs = 0, fillerTotal = 0, covered = 0, total = 0;
    PARKSENSE.forEach((s, i) => {
      const dur = s.taken[a]! * 1000;
      const text = a === 1 ? s.transcript : s.transcript.split(/(?<=[.?!])\s+/).map((x, k) => (k % 2 === 1 ? `Um, ${x[0]!.toLowerCase()}${x.slice(1)}` : x)).join(" ");
      const f = countFillers(text); const wc = countWords(text);
      const missed = s.missed[a]!; const cov = [0, 1, 2].filter((x) => !missed.includes(x));
      totalMs += dur; fillerTotal += f.total; covered += cov.length; total += 3;
      results.push({ session_id: sid, slide_index: i, duration_ms: dur, suggested_seconds: sugg[i]!, word_count: wc, wpm: calcWpm(wc, dur), transcript: text, word_timings: [], filler_count: f.total, fillers: f.fillers, key_points_covered: cov, key_points_missed: missed, off_topic_quotes: s.off[a]!, slide_feedback: null });
    });
    reports.push({ id: `${DECK_ID}-rep${a + 1}`, session_id: sid, owner_id: ownerId, deck_id: DECK_ID, attempt_number: a + 1, overall_score: r.overall, coverage_score: r.coverage, clarity_score: r.clarity, timing_score: r.timing, filler_score: r.fillers, overall_wpm: r.wpm, total_duration_ms: totalMs, key_points_covered: covered, key_points_total: total, filler_total: fillerTotal, headline: r.headline, top_fixes: [...r.fixes], did_well: [...r.well], delta_from_first: a === 0 ? null : r.overall - PARKSENSE_REPORTS[0].overall, first_attempt_score: a === 0 ? null : PARKSENSE_REPORTS[0].overall, scoring_version: "v1", models: null, created_at: dates[a]! });
  });
  const usageEvents = Array.from({ length: sessionsToday }, (_, k) => hoursAgo((k + 1) / 3600));
  return { deck, slides, sessions, results, reports, usageEvents };
}

export function seedState(persona: PersonaId): MockState {
  const owner: MockUser = { id: OWNER_ID, email: "dubbakasathwik@gmail.com", fullName: "Sathwik D", avatarUrl: null, role: "admin" };
  const student: MockUser = { id: SEED_USER_ID, email: "ananya.rao@gmail.com", fullName: "Ananya Rao", avatarUrl: null, role: "student" };
  const stu = students();
  const pol = policies();
  const base: MockState = {
    version: 1, persona, signedIn: persona !== "signed_out",
    user: persona === "admin" ? owner : student,
    profile: blankProfile(persona === "admin" ? owner : student),
    policies: pol, acceptedPolicyIds: [], decks: [], slides: [], sessions: [], results: [], reports: [], ratings: [], usageEvents: [], uploads: {}, clips: {}, seededImages: {},
    students: stu, adminRatings: adminRatings(stu), sessionsPerDay: [...[18, 24, 22, 31, 28, 35, 41, 38, 46, 52, 49, 58, 61, 66]],
    aiSlots: aiSlots(), aiPerDay: structuredClone(AI_PER_DAY_SEED),
    aiModels: { slide_reading: "meta/llama-3.2-11b-vision-instruct", speech_to_text: "parakeet-tdt-0.6b-v2", report_generation: "nvidia/nemotron-3-ultra-550b-a55b" },
    fail: null, nextSignIn: "new_student",
  };
  const onboarded = (p: ProfileRow): ProfileRow => ({ ...p, college: "RV Institute of Technology", year: "3rd year", branch: "CSE", profile_completed_at: hoursAgo(24 * 20) });
  const acceptAll = () => pol.map((p) => p.id);
  switch (persona) {
    case "signed_out": case "new_student": return base;
    case "admin": return { ...base, profile: { ...base.profile, role: "admin" }, acceptedPolicyIds: [] };
    case "student": return { ...base, profile: onboarded(base.profile), acceptedPolicyIds: acceptAll() };
    default: break;
  }
  const h = parksenseHistory(student.id, persona === "at_limit" ? 5 : 2);
  const prof = onboarded(base.profile);
  const common = { ...base, acceptedPolicyIds: acceptAll(), decks: [h.deck], slides: h.slides, sessions: h.sessions, results: h.results, reports: h.reports, usageEvents: h.usageEvents, seededImages: { [DECK_ID]: PARKSENSE.map((_, i) => `/mock/slides/parksense-${i + 1}.jpg`) } };
  if (persona === "blocked") return { ...common, profile: { ...prof, is_blocked: true, blocked_at: hoursAgo(5) } };
  return { ...common, profile: prof };
}

export const SEED_IDS = { OWNER_ID, SEED_USER_ID, DECK_ID };
