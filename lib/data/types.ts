// Types of the data port. Row types come from the generated database types; composed shapes mirror docs/phase-1/api-contracts.md.
import type { Database } from "@/types/database";
import type { Purpose, Slot } from "@shared/constants.ts";

type T = Database["public"]["Tables"];
export type ProfileRow = T["profiles"]["Row"];
export type PolicyVersionRow = T["policy_versions"]["Row"];
export type DeckRow = T["decks"]["Row"];
export type SlideRow = T["slides"]["Row"];
export type SessionRow = T["practice_sessions"]["Row"];
export type SlideResultRow = T["session_slide_results"]["Row"];
export type ReportRow = T["reports"]["Row"];
export type RatingRow = T["report_ratings"]["Row"];

export type Role = "student" | "admin";
export type AuthSession = { userId: string; email: string; fullName: string | null; avatarUrl: string | null; role: Role };

export type DeckStatus = "awaiting_upload" | "awaiting_images" | "processing" | "ready" | "failed";
export type SessionStatus = "in_progress" | "uploading_audio" | "transcribing" | "generating_report" | "completed" | "failed" | "abandoned";

export type DashboardStats = {
  sessions_used_today: number; daily_limit: number; next_reset_at: string; attempts_count: number;
  average_score: number | null; best_score: number | null; total_practice_ms: number; total_key_points_covered: number;
};

/** `my_decks()` row. */
export type DeckSummary = {
  deck_id: string; title: string; page_count: number; pinned: boolean; pinned_at: string | null; created_at: string;
  attempts_count: number; latest_score: number | null; latest_attempt_at: string | null;
};
/** `my_deck_detail(p_deck_id)` row. */
export type DeckAttempt = {
  report_id: string; session_id: string; attempt_number: number; created_at: string; overall_score: number; coverage_score: number;
  clarity_score: number; timing_score: number; filler_score: number; overall_wpm: number | null; delta_from_first: number | null;
};
/** Deck row + its slides (direct reads) + the total minutes of the latest session (practice_sessions read). */
export type DeckDetail = { deck: DeckRow; slides: SlideRow[]; latest_total_minutes: number | null; total_target_seconds: number | null };

export type SignedUpload = { url: string; method: "PUT"; headers: Record<string, string>; expires_at: string };
export type UploadInit = { deck_id: string; upload: SignedUpload };
export type SlideImageRules = { max_width: number; min_width: number; jpeg_quality: number; min_jpeg_quality: number; max_bytes: number; content_type: "image/jpeg" };
export type UploadComplete = { deck_id: string; page_count: number; images: { slide_index: number; upload: SignedUpload }[]; rules: SlideImageRules };
export type ProcessResult = { deck_id: string; status: "processing" | "ready" };
export type AssetKind = "slide_image" | "deck_pdf";
export type AssetUrls = { deck_id: string; expires_at: string; files: { kind: AssetKind; slide_index: number | null; url: string }[] };

export type ClipDeclaration = { slide_index: number; size_bytes: number };
export type SubmitInit = { session_id: string; clips: { slide_index: number; upload: SignedUpload }[] };
export type AnalyseResult = { session_id: string; status: "transcribing" | "completed"; report_id?: string };

export type ReportSlideInfo = { slide_index: number; title: string | null; key_points: string[] };
export type ReportFiller = { word: string; count: number };
export type ReportDetail = {
  report: ReportRow;
  results: (Omit<SlideResultRow, "fillers" | "word_timings"> & { fillers: ReportFiller[]; word_timings: { w: string; start_ms: number; end_ms: number }[] })[];
  slides: ReportSlideInfo[];
  deck_title: string;
  deck_id: string;
  target_seconds: number;
  rating: { stars: number; comment: string | null } | null;
};
export type ReportListItem = { report_id: string; deck_id: string; deck_title: string; overall_score: number; attempt_number: number; created_at: string };

// ---- realtime payloads (postgres_changes on decks / practice_sessions) ----
export type DeckEvent = Pick<DeckRow, "id" | "status" | "processing_stage" | "processed_slides" | "error_code" | "page_count">;
export type SessionEvent = Pick<SessionRow, "id" | "status" | "analysis_stage" | "error_code"> & { report_id?: string | null };

// ---- admin ----
export type AdminOverview = { total_students: number; sessions_last_14_days: number; sessions_all_time: number; average_rating: number | null; ratings_count: number; ai_credits_used: number };
export type SessionsPerDay = { day: string; count: number };
export type AdminStudent = { user_id: string; full_name: string | null; email: string; college: string | null; year: string | null; branch: string | null; avatar_url: string | null; attempts: number; last_active_at: string | null; average_score: number | null; is_blocked: boolean; total_count: number };
export type AdminStudentDetail = {
  profile: { user_id: string; full_name: string | null; email: string; college: string | null; year: string | null; branch: string | null; avatar_url: string | null; is_blocked: boolean; last_active_at: string | null; created_at: string };
  attempts: { report_id: string; deck_title: string; attempt_number: number; date: string; overall_score: number }[];
  ratings: { deck_title: string; stars: number; comment: string | null; date: string }[];
};
export type AdminRatings = { average: number | null; count: number; rows: { student_name: string; user_id: string; deck_title: string; stars: number; comment: string | null; date: string }[] };
export type AiSlotUsage = { slot_id: string; slot: Slot; credit_limit: number; used: number; remaining: number; percent_used: number; running_low: boolean; cooldown_until: string | null; last_error_code: string | null };
export type AdminAiUsage = { purposes: { purpose: Purpose; slots: AiSlotUsage[]; per_day: { date: string; count: number }[] }[] };
/** `admin-ai-keys` response. */
export type AdminAiKeys = { purposes: { purpose: Purpose; model: string; slots: { slot_id: string; slot: Slot; configured: boolean; masked: string }[] }[] };
export type AdminPolicyVersion = { id: string; version_label: string; note: string | null; published_at: string; published_by: string | null; is_live: boolean; terms_body: string; privacy_body: string };

// ---- ports ----
export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  onChange(cb: (s: AuthSession | null) => void): () => void;
  /** Real adapter: redirects to Google. Mock adapter: signs in immediately as the selected persona (`hint: "owner"` → the admin). */
  signInWithGoogle(opts?: { next?: string; hint?: "owner" }): Promise<void>;
  signOut(): Promise<void>;
}
export interface ProfilePort {
  getMine(): Promise<ProfileRow>;
  update(input: { college: string; year: string; branch: string; full_name?: string }): Promise<ProfileRow>;
}
export interface PolicyPort {
  /** Readable by anon (Terms/Privacy are public). */
  getLatest(): Promise<PolicyVersionRow>;
  hasAcceptedLatest(): Promise<boolean>;
  /** Version ids this user has accepted (policy_acceptances direct read): non-empty ⇒ the Terms screen is the "updated" variant. */
  listAccepted(): Promise<string[]>;
  accept(versionId: string): Promise<void>;
}
export interface DashboardPort {
  getStats(): Promise<DashboardStats>;
  listRecentReports(limit: number): Promise<ReportListItem[]>;
}
export interface DecksPort {
  list(): Promise<DeckSummary[]>;
  get(deckId: string): Promise<DeckDetail>;
  attempts(deckId: string): Promise<DeckAttempt[]>;
  setPinned(deckId: string, pinned: boolean): Promise<void>;
  getAssetUrls(deckId: string, kinds: AssetKind[]): Promise<AssetUrls>;
  /** Current row (direct read) — used to hydrate before/while subscribed to realtime. */
  getStatus(deckId: string): Promise<DeckEvent>;
}
export interface UploadPort {
  init(input: { filename: string; size_bytes: number; content_type: string }): Promise<UploadInit>;
  complete(deckId: string): Promise<UploadComplete>;
  process(deckId: string): Promise<ProcessResult>;
}
export interface SessionsPort {
  start(deckId: string, totalMinutes: number): Promise<SessionRow>;
  get(sessionId: string): Promise<SessionEvent & { deck_id: string; attempt_number: number; total_minutes: number; suggested_seconds: number[] }>;
  /** The latest in-progress / failed session of a deck (to resume), or null. */
  getOpenForDeck(deckId: string): Promise<SessionRow | null>;
  submitInit(sessionId: string, clips: ClipDeclaration[]): Promise<SubmitInit>;
  analyse(sessionId: string): Promise<AnalyseResult>;
}
export interface ReportsPort {
  get(reportId: string): Promise<ReportDetail>;
  getBySession(sessionId: string): Promise<{ report_id: string }>;
  rate(reportId: string, stars: number, comment?: string): Promise<RatingRow>;
}
export type Unsubscribe = () => void;
export interface RealtimePort {
  subscribeDeck(deckId: string, cb: (e: DeckEvent) => void): Unsubscribe;
  subscribeSession(sessionId: string, cb: (e: SessionEvent) => void): Unsubscribe;
}
export interface AccountPort { delete(confirm: "DELETE"): Promise<{ deleted: true; storage_cleanup: "complete" | "pending" }> }
export interface AdminPort {
  overview(): Promise<AdminOverview>;
  sessionsPerDay(days: number): Promise<SessionsPerDay[]>;
  listStudents(input: { search?: string; limit?: number; offset?: number }): Promise<AdminStudent[]>;
  studentDetail(userId: string): Promise<AdminStudentDetail>;
  setBlocked(userId: string, blocked: boolean): Promise<void>;
  ratings(stars?: number): Promise<AdminRatings>;
  aiUsage(days: number): Promise<AdminAiUsage>;
  aiKeys(): Promise<AdminAiKeys>;
  policyVersions(): Promise<AdminPolicyVersion[]>;
  publishPolicy(input: { version_label: string; terms_body: string; privacy_body: string; note?: string }): Promise<PolicyVersionRow>;
}
export interface DataPort {
  auth: AuthPort; profile: ProfilePort; policy: PolicyPort; dashboard: DashboardPort; decks: DecksPort; upload: UploadPort;
  sessions: SessionsPort; reports: ReportsPort; realtime: RealtimePort; account: AccountPort; admin: AdminPort;
}
