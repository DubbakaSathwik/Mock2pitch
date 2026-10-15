// The mock implementation of the data port: an in-memory backend that follows the Phase 1 contracts (error codes, limits, stages).
import { DAILY_SESSION_LIMIT, MAX_CLIP_BYTES, MAX_PDF_BYTES, MAX_SLIDES, MAX_TOTAL_MINUTES, MIN_TOTAL_MINUTES, PURPOSES,
  PUT_EXPIRES_S, AUDIO_PUT_EXPIRES_S, GET_EXPIRES_S, SLIDE_IMAGE_JPEG_QUALITY, SLIDE_IMAGE_MAX_BYTES, SLIDE_IMAGE_MAX_WIDTH, SLIDE_IMAGE_MIN_JPEG_QUALITY, SLIDE_IMAGE_MIN_WIDTH, type Purpose } from "@shared/constants.ts";
import { isJpegSignature, parseWav, titleFromFilename } from "@shared/files.ts";
import { suggestedSeconds } from "@shared/scoring.ts";
import { AppError, toAppError } from "../errors";
import { istDateString, nextIstMidnight } from "@/lib/format";
import type {
  AdminAiKeys, AdminAiUsage, AdminOverview, AdminPolicyVersion, AdminRatings, AdminStudent, AdminStudentDetail, AuthSession, DashboardStats, DataPort, DeckAttempt,
  DeckDetail, DeckEvent, DeckRow, DeckSummary, ProcessResult, RatingRow, ReportDetail, ReportListItem, SessionEvent, SessionRow, SessionsPerDay, SignedUpload,
  UploadComplete, UploadInit, Unsubscribe,
} from "../types";
import { BlobStore } from "./blobs";
import { generateAnalysis, readSlideFromText } from "./content";
import { PERSONAS, seedState, uuid, type FailPlan, type MockState, type PersonaId } from "./state";
import { TERMS_V3 } from "./seed-content";

export type MockConfig = { latencyMs: number; stageMs: number; realtime: boolean };
export const DEFAULT_MOCK_CONFIG: MockConfig = { latencyMs: 120, stageMs: 650, realtime: true };
export const STORAGE_KEYS = { state: "m2p.mock.state.v1", seed: "m2p.mock.seed", config: "m2p.mock.config" } as const;

export type MockControl = {
  getPersona(): PersonaId;
  setPersona(id: PersonaId): void;
  setNextSignIn(id: PersonaId): void;
  reset(): void;
  republishPolicy(): void;
  failNext(plan: FailPlan): void;
  failNextPuts(n: number): void;
  breakAssetUrlsOnce(): void;
  getConfig(): MockConfig;
  setConfig(p: Partial<MockConfig>): void;
  subscribe(cb: () => void): () => void;
  snapshot(): MockState;
};

type Opts = { storage?: Storage | null; persona?: PersonaId; config?: Partial<MockConfig>; now?: () => Date };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => (x === undefined ? x : structuredClone(x));
const iso = (d: Date) => d.toISOString();

export class MockBackend {
  state: MockState;
  cfg: MockConfig;
  readonly blobs = new BlobStore();
  private deckSubs = new Map<string, Set<(e: DeckEvent) => void>>();
  private sessionSubs = new Map<string, Set<(e: SessionEvent) => void>>();
  private authSubs = new Set<(s: AuthSession | null) => void>();
  private changeSubs = new Set<() => void>();
  private breakUrls = false;
  private disposed = false;
  private clock: () => Date;

  constructor(private opts: Opts = {}) {
    this.clock = opts.now ?? (() => new Date());
    this.cfg = { ...DEFAULT_MOCK_CONFIG, ...this.readJson<Partial<MockConfig>>(STORAGE_KEYS.config), ...opts.config };
    this.blobs.stepDelayMs = this.cfg.latencyMs > 0 ? 40 : 0;
    const seed = this.read(STORAGE_KEYS.seed) as PersonaId | null;
    const saved = this.readJson<MockState>(STORAGE_KEYS.state);
    if (seed && (PERSONAS as readonly string[]).includes(seed)) {
      this.state = seedState(seed);
      try { this.opts.storage?.removeItem(STORAGE_KEYS.seed); } catch { /* ignore */ }
    } else if (saved && saved.version === 1 && !opts.persona) this.state = saved;
    else this.state = seedState(opts.persona ?? "signed_out");
    this.persist();
    this.resume();
  }

  // ---------------------------------------------------------------- storage / change plumbing
  private read(k: string): string | null { try { return this.opts.storage?.getItem(k) ?? null; } catch { return null; } }
  private readJson<T>(k: string): T | null { const r = this.read(k); if (!r) return null; try { return JSON.parse(r) as T; } catch { return null; } }
  private persist() { try { this.opts.storage?.setItem(STORAGE_KEYS.state, JSON.stringify(this.state)); } catch { /* quota / private mode */ } }
  private touch() { this.persist(); this.changeSubs.forEach((cb) => cb()); }
  dispose() { this.disposed = true; this.blobs.clear(); }
  private now() { return this.clock(); }

  private async call<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.cfg.latencyMs > 0) await sleep(this.cfg.latencyMs);
    try { return clone(await fn()); } catch (e) { throw toAppError(e); }
  }

  // ---------------------------------------------------------------- guards (mirror private.assert_can_practise)
  private me() { if (!this.state.signedIn) throw new AppError("not_authenticated"); return this.state.user; }
  private requireAdmin() { const u = this.me(); if (u.role !== "admin") throw new AppError("forbidden"); return u; }
  private usedToday(): number { const today = istDateString(this.now()); return this.state.usageEvents.filter((t) => istDateString(new Date(t)) === today).length; }
  private latestPolicy() { return [...this.state.policies].sort((a, b) => a.published_at.localeCompare(b.published_at)).at(-1)!; }
  private acceptedLatest() { return this.state.user.role === "admin" || this.state.acceptedPolicyIds.includes(this.latestPolicy().id); }
  private assertCanPractise(o: { limit?: boolean; policy?: boolean } = {}) {
    const u = this.me();
    if (u.role === "admin") throw new AppError("is_admin");
    if (this.state.profile.is_blocked) throw new AppError("blocked");
    if (!this.state.profile.profile_completed_at) throw new AppError("profile_incomplete");
    if (o.policy !== false && !this.acceptedLatest()) throw new AppError("policy_not_accepted");
    if (o.limit !== false && this.usedToday() >= DAILY_SESSION_LIMIT) throw new AppError("daily_limit_reached");
  }
  private consume() {
    if (this.usedToday() >= DAILY_SESSION_LIMIT) throw new AppError("daily_limit_reached");
    this.state.usageEvents.push(iso(this.now()));
  }
  private deckOf(id: string): DeckRow { const d = this.state.decks.find((x) => x.id === id && x.owner_id === this.me().id); if (!d) throw new AppError("not_found"); return d; }
  private sessionOf(id: string): SessionRow { const s = this.state.sessions.find((x) => x.id === id && x.owner_id === this.me().id); if (!s) throw new AppError("not_found"); return s; }

  // ---------------------------------------------------------------- realtime
  private emitDeck(d: DeckRow) {
    if (!this.cfg.realtime) return;
    const e: DeckEvent = { id: d.id, status: d.status, processing_stage: d.processing_stage, processed_slides: d.processed_slides, error_code: d.error_code, page_count: d.page_count };
    this.deckSubs.get(d.id)?.forEach((cb) => cb(clone(e)));
  }
  private sessionEvent(s: SessionRow): SessionEvent {
    return { id: s.id, status: s.status as SessionEvent["status"], analysis_stage: s.analysis_stage, error_code: s.error_code, report_id: this.state.reports.find((r) => r.session_id === s.id)?.id ?? null };
  }
  private emitSession(s: SessionRow) { if (this.cfg.realtime) this.sessionSubs.get(s.id)?.forEach((cb) => cb(clone(this.sessionEvent(s)))); }
  private setDeck(d: DeckRow, patch: Partial<DeckRow>) { Object.assign(d, patch, { updated_at: iso(this.now()) }); this.touch(); this.emitDeck(d); }
  private setSession(s: SessionRow, patch: Partial<SessionRow>) { Object.assign(s, patch, { updated_at: iso(this.now()) }); this.touch(); this.emitSession(s); }

  // ---------------------------------------------------------------- pipelines (resumable after a page refresh)
  private resume() {
    for (const d of this.state.decks) if (d.status === "processing") void this.runDeck(d.id);
    for (const s of this.state.sessions) if (s.status === "transcribing" || s.status === "generating_report") void this.runAnalysis(s.id);
  }
  private async stage() { if (this.cfg.stageMs > 0) await sleep(this.cfg.stageMs); }

  private async runDeck(deckId: string) {
    const deck = this.state.decks.find((d) => d.id === deckId);
    if (!deck || !deck.page_count) return;
    const n = deck.page_count;
    const texts = this.state.uploads[deckId]?.pageTexts ?? [];
    for (let i = deck.processed_slides; i < n; i++) {
      this.setDeck(deck, { status: "processing", processing_stage: `Reading slide ${i + 1} of ${n}` });
      await this.stage();
      if (this.disposed) return;
      if (this.state.fail?.kind === "deck-process") {
        const code = this.state.fail.code === "ai_unavailable" ? "ai_unavailable" : "processing_failed";
        this.state.fail = null;
        this.setDeck(deck, { status: "failed", processing_stage: null, error_code: code });
        return;
      }
      if (!this.state.slides.some((s) => s.deck_id === deckId && s.slide_index === i)) {
        const r = readSlideFromText(texts[i] ?? null, i);
        const t = iso(this.now());
        this.state.slides.push({ id: uuid(), deck_id: deckId, slide_index: i, title: r.title, extracted_text: r.extracted_text, key_points: r.key_points, suggested_script: r.script, time_weight: r.weight, image_file_id: `up-${deckId}-${i}`, created_at: t, updated_at: t });
      }
      this.setDeck(deck, { processed_slides: i + 1 });
    }
    this.setDeck(deck, { status: "ready", processing_stage: null, error_code: null });
  }

  private async runAnalysis(sessionId: string) {
    const session = this.state.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const clips = this.state.clips[sessionId] ?? [];
    const m = clips.length;
    // `session-analyse` already published this stage; do not emit it twice
    if (session.analysis_stage !== "Transcribing your recording") this.setSession(session, { status: "transcribing", analysis_stage: "Transcribing your recording", error_code: null });
    await this.stage();
    for (let k = 1; k <= m; k++) {
      if (this.disposed) return;
      if (this.state.fail?.kind === "session-analyse" && k === Math.min(2, m)) {
        const code = this.state.fail.code === "ai_unavailable" ? "ai_unavailable" : this.state.fail.code === "report_invalid" ? "report_invalid" : "analysis_failed";
        if (code !== "report_invalid") { this.state.fail = null; this.setSession(session, { status: "failed", analysis_stage: null, error_code: code }); return; }
      }
      this.setSession(session, { analysis_stage: `Transcribed ${k} of ${m}` });
      await this.stage();
    }
    this.setSession(session, { status: "generating_report", analysis_stage: "Writing your report" });
    await this.stage(); await this.stage();
    if (this.disposed) return;
    if (this.state.fail?.kind === "session-analyse") { const code = this.state.fail.code === "report_invalid" ? "report_invalid" : "analysis_failed"; this.state.fail = null; this.setSession(session, { status: "failed", analysis_stage: null, error_code: code }); return; }
    const slides = this.state.slides.filter((s) => s.deck_id === session.deck_id).sort((a, b) => a.slide_index - b.slide_index);
    const infos = await Promise.all(clips.map(async (c) => {
      const blob = this.blobs.get(`clip/${sessionId}/${c.slide_index}`);
      const info = blob ? parseWav(new Uint8Array(await blob.arrayBuffer()), blob.size) : null;
      return { slide_index: c.slide_index, durationMs: info && info.ok ? info.durationMs : 0 };
    }));
    const first = this.state.reports.find((r) => r.deck_id === session.deck_id && r.attempt_number === 1);
    const { report, results } = generateAnalysis({ session, slides, clips: infos, firstAttemptScore: session.attempt_number > 1 ? first?.overall_score ?? null : null, reportId: uuid(), createdAt: iso(this.now()) });
    this.state.reports.push(report);
    this.state.results.push(...results);
    this.blobs.deletePrefix(`clip/${sessionId}/`); // audio is deleted once the report exists
    this.setSession(session, { status: "completed", analysis_stage: null, completed_at: iso(this.now()), error_code: null });
  }

  // ---------------------------------------------------------------- helpers for upload targets
  private target(path: string, headers: Record<string, string>, seconds: number): SignedUpload {
    return { url: `mock://put/${path}`, method: "PUT", headers, expires_at: iso(new Date(this.now().getTime() + seconds * 1000)) };
  }
  private failDeck(d: DeckRow, code: string) {
    this.blobs.deletePrefix(`pdf/${d.id}`);
    this.setDeck(d, { status: "failed", error_code: code, processing_stage: null });
  }

  // ---------------------------------------------------------------- the port
  readonly port: DataPort = {
    auth: {
      getSession: () => this.call(() => this.authSession()),
      onChange: (cb) => { this.authSubs.add(cb); return () => this.authSubs.delete(cb); },
      signInWithGoogle: (o) => this.call(() => {
        const wantOwner = o?.hint === "owner";
        if (this.state.persona === "signed_out" || (wantOwner && this.state.user.role !== "admin")) this.switchPersona(wantOwner ? "admin" : this.state.nextSignIn, true);
        else { this.state.signedIn = true; this.touch(); }
        this.authSubs.forEach((cb) => cb(this.authSession()));
      }),
      signOut: () => this.call(() => { this.state.signedIn = false; this.touch(); this.authSubs.forEach((cb) => cb(null)); }),
    },
    profile: {
      getMine: () => this.call(() => { this.me(); return this.state.profile; }),
      update: (input) => this.call(() => {
        this.me();
        if (this.state.profile.is_blocked) throw new AppError("blocked");
        const p = this.state.profile;
        const college = input.college.trim();
        if (!college) throw new AppError("profile_incomplete", "Enter your college name");
        Object.assign(p, { college, year: input.year, branch: input.branch, full_name: input.full_name ?? p.full_name, updated_at: iso(this.now()) });
        if (p.college && p.year && p.branch && !p.profile_completed_at) p.profile_completed_at = iso(this.now());
        this.state.user.fullName = p.full_name;
        this.touch();
        return p;
      }),
    },
    policy: {
      getLatest: () => this.call(() => this.latestPolicy()),
      hasAcceptedLatest: () => this.call(() => { this.me(); return this.acceptedLatest(); }),
      listAccepted: () => this.call(() => { this.me(); return [...this.state.acceptedPolicyIds]; }),
      accept: (versionId) => this.call(() => {
        const u = this.me();
        if (u.role === "admin") throw new AppError("is_admin");
        if (this.state.profile.is_blocked) throw new AppError("blocked");
        if (versionId !== this.latestPolicy().id) throw new AppError("not_latest_policy");
        if (!this.state.acceptedPolicyIds.includes(versionId)) this.state.acceptedPolicyIds.push(versionId);
        this.touch();
      }),
    },
    dashboard: {
      getStats: () => this.call((): DashboardStats => {
        const u = this.me();
        const mine = this.state.reports.filter((r) => r.owner_id === u.id);
        const scores = mine.map((r) => r.overall_score);
        return {
          sessions_used_today: this.usedToday(), daily_limit: DAILY_SESSION_LIMIT, next_reset_at: nextIstMidnight(this.now()), attempts_count: mine.length,
          average_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, best_score: scores.length ? Math.max(...scores) : null,
          total_practice_ms: mine.reduce((a, r) => a + (r.total_duration_ms ?? 0), 0), total_key_points_covered: mine.reduce((a, r) => a + (r.key_points_covered ?? 0), 0),
        };
      }),
      listRecentReports: (limit) => this.call((): ReportListItem[] => {
        const u = this.me();
        return this.state.reports.filter((r) => r.owner_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
          .map((r) => ({ report_id: r.id, deck_id: r.deck_id, deck_title: this.state.decks.find((d) => d.id === r.deck_id)?.title ?? "Deck", overall_score: r.overall_score, attempt_number: r.attempt_number, created_at: r.created_at }));
      }),
    },
    decks: {
      list: () => this.call((): DeckSummary[] => {
        const u = this.me();
        const rows = this.state.decks.filter((d) => d.owner_id === u.id && d.status === "ready").map((d) => {
          const reps = this.state.reports.filter((r) => r.deck_id === d.id).sort((a, b) => a.attempt_number - b.attempt_number);
          return { deck_id: d.id, title: d.title, page_count: d.page_count ?? 0, pinned: !!d.pinned_at, pinned_at: d.pinned_at, created_at: d.created_at, attempts_count: reps.length, latest_score: reps.at(-1)?.overall_score ?? null, latest_attempt_at: reps.at(-1)?.created_at ?? null };
        });
        return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "") || (b.latest_attempt_at ?? b.created_at).localeCompare(a.latest_attempt_at ?? a.created_at));
      }),
      get: (deckId) => this.call((): DeckDetail => {
        const deck = this.deckOf(deckId);
        const slides = this.state.slides.filter((s) => s.deck_id === deckId).sort((a, b) => a.slide_index - b.slide_index);
        const last = this.state.sessions.filter((s) => s.deck_id === deckId && s.status !== "abandoned").sort((a, b) => b.attempt_number - a.attempt_number)[0];
        return { deck, slides, latest_total_minutes: last?.total_minutes ?? null, total_target_seconds: last ? last.suggested_seconds.reduce((a, b) => a + b, 0) : null };
      }),
      attempts: (deckId) => this.call((): DeckAttempt[] => {
        this.deckOf(deckId);
        return this.state.reports.filter((r) => r.deck_id === deckId).sort((a, b) => a.attempt_number - b.attempt_number).map((r) => ({
          report_id: r.id, session_id: r.session_id, attempt_number: r.attempt_number, created_at: r.created_at, overall_score: r.overall_score, coverage_score: r.coverage_score,
          clarity_score: r.clarity_score, timing_score: r.timing_score, filler_score: r.filler_score, overall_wpm: r.overall_wpm, delta_from_first: r.delta_from_first,
        }));
      }),
      setPinned: (deckId, pinned) => this.call(() => {
        this.assertCanPractise({ limit: false, policy: false });
        const d = this.deckOf(deckId);
        d.pinned_at = pinned ? iso(this.now()) : null;
        this.touch();
      }),
      getAssetUrls: (deckId, kinds) => this.call(() => {
        const d = this.deckOf(deckId);
        const files: { kind: "slide_image" | "deck_pdf"; slide_index: number | null; url: string }[] = [];
        if (kinds.includes("slide_image")) {
          const seeded = this.state.seededImages[deckId];
          for (let i = 0; i < (d.page_count ?? 0); i++) {
            const url = this.breakUrls ? `/mock/slides/expired-${i}.jpg` : seeded?.[i] ?? this.blobs.objectUrl(`slide/${deckId}/${i}`);
            if (url) files.push({ kind: "slide_image", slide_index: i, url });
          }
          this.breakUrls = false;
        }
        if (kinds.includes("deck_pdf")) { const url = this.blobs.objectUrl(`pdf/${deckId}`); if (url) files.push({ kind: "deck_pdf", slide_index: null, url }); }
        return { deck_id: deckId, expires_at: iso(new Date(this.now().getTime() + GET_EXPIRES_S * 1000)), files };
      }),
      getStatus: (deckId) => this.call((): DeckEvent => { const d = this.deckOf(deckId); return { id: d.id, status: d.status, processing_stage: d.processing_stage, processed_slides: d.processed_slides, error_code: d.error_code, page_count: d.page_count }; }),
    },
    upload: {
      init: (input) => this.call((): UploadInit => {
        this.assertCanPractise();
        if (!/\.pdf$/i.test(input.filename) || input.content_type !== "application/pdf" || input.size_bytes <= 0) throw new AppError("not_pdf");
        if (input.size_bytes > MAX_PDF_BYTES) throw new AppError("too_large");
        const u = this.state.user;
        if (this.state.decks.some((d) => d.owner_id === u.id && d.status === "processing")) throw new AppError("deck_in_progress", "Finish your current deck first");
        this.state.decks = this.state.decks.filter((d) => !(d.owner_id === u.id && d.status === "awaiting_upload"));
        const t = iso(this.now()); const id = uuid();
        this.state.decks.push({ id, owner_id: u.id, title: titleFromFilename(input.filename), original_filename: input.filename, page_count: null, status: "awaiting_upload", processing_stage: null, processed_slides: 0, error_code: null, pinned_at: null, created_at: t, updated_at: t });
        this.state.uploads[id] = { filename: input.filename, size: input.size_bytes, pageTexts: null, page_count: null };
        this.blobs.expect(`pdf/${id}`, { type: "application/pdf", size: input.size_bytes });
        this.touch();
        return { deck_id: id, upload: this.target(`pdf/${id}`, { "Content-Type": "application/pdf", "Content-Length": String(input.size_bytes) }, PUT_EXPIRES_S) };
      }),
      complete: (deckId) => this.call(async (): Promise<UploadComplete> => {
        this.assertCanPractise({ limit: false });
        const deck = this.deckOf(deckId);
        const rules = { max_width: SLIDE_IMAGE_MAX_WIDTH, min_width: SLIDE_IMAGE_MIN_WIDTH, jpeg_quality: SLIDE_IMAGE_JPEG_QUALITY, min_jpeg_quality: SLIDE_IMAGE_MIN_JPEG_QUALITY, max_bytes: SLIDE_IMAGE_MAX_BYTES, content_type: "image/jpeg" as const };
        const issue = (n: number) => Array.from({ length: n }, (_, i) => { this.blobs.expect(`slide/${deckId}/${i}`, { type: "image/jpeg" }); return { slide_index: i, upload: this.target(`slide/${deckId}/${i}`, { "Content-Type": "image/jpeg" }, PUT_EXPIRES_S) }; });
        if (deck.status === "awaiting_images") return { deck_id: deckId, page_count: deck.page_count!, images: issue(deck.page_count!), rules };
        if (deck.status !== "awaiting_upload") throw new AppError("invalid_state");
        const pdf = this.blobs.get(`pdf/${deckId}`);
        if (!pdf) throw new AppError("upload_missing");
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") { this.failDeck(deck, "not_pdf"); throw new AppError("not_pdf"); }
        const { openPdf, extractPageTexts, closePdf } = await import("@/features/upload/pdf");
        const opened = await openPdf(bytes);
        if (!opened.ok) { const code = opened.reason === "encrypted" ? "encrypted_pdf" : "corrupt_pdf"; this.failDeck(deck, code); throw new AppError(code); }
        if (opened.pageCount > MAX_SLIDES) { this.failDeck(deck, "too_many_pages"); void closePdf(opened.doc); throw new AppError("too_many_pages", `That deck has ${opened.pageCount} slides`, { page_count: opened.pageCount, max_pages: MAX_SLIDES }); }
        const texts = await extractPageTexts(opened.doc).catch(() => []);
        void closePdf(opened.doc);
        try { this.consume(); } catch (e) { this.failDeck(deck, "daily_limit_reached"); throw e; }
        this.state.uploads[deckId] = { ...this.state.uploads[deckId]!, pageTexts: texts, page_count: opened.pageCount };
        this.setDeck(deck, { status: "awaiting_images", page_count: opened.pageCount, processing_stage: "Waiting for slide images", error_code: null });
        return { deck_id: deckId, page_count: opened.pageCount, images: issue(opened.pageCount), rules };
      }),
      process: (deckId) => this.call(async (): Promise<ProcessResult> => {
        this.assertCanPractise({ limit: false });
        const deck = this.deckOf(deckId);
        if (deck.status === "ready") return { deck_id: deckId, status: "ready" };
        if (deck.status === "processing") return { deck_id: deckId, status: "processing" };
        if (!(deck.status === "awaiting_images" || (deck.status === "failed" && deck.page_count))) throw new AppError("invalid_state");
        const missing: number[] = [];
        for (let i = 0; i < deck.page_count!; i++) {
          const b = this.blobs.get(`slide/${deckId}/${i}`);
          if (!b) { missing.push(i); continue; }
          if (!isJpegSignature(new Uint8Array(await b.slice(0, 3).arrayBuffer()))) throw new AppError("not_jpeg", undefined, { slide_index: i });
          if (b.size > SLIDE_IMAGE_MAX_BYTES) throw new AppError("image_too_large", undefined, { slide_index: i });
        }
        if (missing.length) throw new AppError("images_missing", undefined, { missing });
        this.setDeck(deck, { status: "processing", processing_stage: `Reading slide ${deck.processed_slides + 1} of ${deck.page_count}`, error_code: null });
        void this.runDeck(deckId);
        return { deck_id: deckId, status: "processing" };
      }),
    },
    sessions: {
      start: (deckId, totalMinutes) => this.call((): SessionRow => {
        this.assertCanPractise({ limit: false });
        if (!Number.isInteger(totalMinutes) || totalMinutes < MIN_TOTAL_MINUTES || totalMinutes > MAX_TOTAL_MINUTES) throw new AppError("invalid_minutes");
        const deck = this.deckOf(deckId);
        if (deck.status !== "ready") throw new AppError("invalid_state");
        const mine = this.state.sessions.filter((s) => s.deck_id === deckId);
        for (const s of mine) if (s.status === "in_progress") s.status = "abandoned";
        const live = mine.filter((s) => s.status !== "abandoned");
        const attempt = Math.max(0, ...live.map((s) => s.attempt_number)) + 1;
        const paid = mine.some((s) => s.attempt_number === attempt && s.status === "abandoned");
        const retake = attempt >= 2 && !paid;
        const slides = this.state.slides.filter((s) => s.deck_id === deckId).sort((a, b) => a.slide_index - b.slide_index);
        if (slides.length !== deck.page_count) throw new AppError("invalid_state");
        if (retake) this.consume();
        const t = iso(this.now());
        const row: SessionRow = { id: uuid(), deck_id: deckId, owner_id: this.state.user.id, attempt_number: attempt, total_minutes: totalMinutes, suggested_seconds: suggestedSeconds(totalMinutes, slides.map((s) => s.time_weight)), status: "in_progress", analysis_stage: null, error_code: null, analysis_attempts: 0, policy_version_id: this.latestPolicy().id, created_at: t, submitted_at: null, completed_at: null, updated_at: t };
        this.state.sessions.push(row);
        this.touch();
        return row;
      }),
      get: (sessionId) => this.call(() => { const s = this.sessionOf(sessionId); return { ...this.sessionEvent(s), deck_id: s.deck_id, attempt_number: s.attempt_number, total_minutes: s.total_minutes, suggested_seconds: s.suggested_seconds }; }),
      getOpenForDeck: (deckId) => this.call(() => {
        this.deckOf(deckId);
        return this.state.sessions.filter((s) => s.deck_id === deckId && (s.status === "in_progress" || s.status === "failed" || s.status === "uploading_audio")).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      }),
      submitInit: (sessionId, clips) => this.call(() => {
        this.me();
        if (this.state.profile.is_blocked) throw new AppError("blocked");
        const s = this.sessionOf(sessionId);
        if (this.state.sessions.some((x) => x.owner_id === s.owner_id && (x.status === "transcribing" || x.status === "generating_report"))) throw new AppError("analysis_in_progress", "Still analysing your previous session");
        if (!["in_progress", "uploading_audio", "failed"].includes(s.status)) throw new AppError("invalid_state");
        const deck = this.deckOf(s.deck_id);
        if (!clips.length) throw new AppError("no_clips");
        const seen = new Set<number>();
        for (const c of clips) {
          if (!Number.isInteger(c.slide_index) || c.slide_index < 0 || c.slide_index >= (deck.page_count ?? 0)) throw new AppError("invalid_slide_index", undefined, { slide_index: c.slide_index });
          if (seen.has(c.slide_index)) throw new AppError("duplicate_slide_index", undefined, { slide_index: c.slide_index });
          seen.add(c.slide_index);
          if (c.size_bytes <= 0) throw new AppError("clip_empty", undefined, { slide_index: c.slide_index });
          if (c.size_bytes > MAX_CLIP_BYTES) throw new AppError("clip_too_large", undefined, { slide_index: c.slide_index });
        }
        this.state.clips[sessionId] = clips.map((c) => ({ slide_index: c.slide_index, size_bytes: c.size_bytes }));
        this.setSession(s, { status: "uploading_audio", submitted_at: iso(this.now()), error_code: null });
        return { session_id: sessionId, clips: clips.map((c) => { this.blobs.expect(`clip/${sessionId}/${c.slide_index}`, { type: "audio/wav", size: c.size_bytes }); return { slide_index: c.slide_index, upload: this.target(`clip/${sessionId}/${c.slide_index}`, { "Content-Type": "audio/wav", "Content-Length": String(c.size_bytes) }, AUDIO_PUT_EXPIRES_S) }; }) };
      }),
      analyse: (sessionId) => this.call(async () => {
        this.me();
        if (this.state.profile.is_blocked) throw new AppError("blocked");
        const s = this.sessionOf(sessionId);
        const existing = this.state.reports.find((r) => r.session_id === sessionId);
        if (s.status === "completed" && existing) return { session_id: sessionId, status: "completed" as const, report_id: existing.id };
        if (s.status === "transcribing" || s.status === "generating_report") throw new AppError("analysis_in_progress");
        if (s.status !== "uploading_audio" && s.status !== "failed") throw new AppError("invalid_state");
        if (s.analysis_attempts >= 3) throw new AppError("max_attempts");
        const declared = this.state.clips[sessionId] ?? [];
        if (!declared.length) throw new AppError("no_clips");
        for (const c of declared) {
          const blob = this.blobs.get(`clip/${sessionId}/${c.slide_index}`);
          if (!blob) throw new AppError("clip_missing", undefined, { slide_index: c.slide_index });
          if (blob.size !== c.size_bytes) throw new AppError("size_mismatch", undefined, { slide_index: c.slide_index });
          const info = parseWav(new Uint8Array(await blob.arrayBuffer()), blob.size);
          if (!info.ok) throw new AppError("audio_invalid", undefined, { slide_index: c.slide_index, reason: info.reason });
        }
        if (this.state.fail?.kind === "session-analyse" && this.state.fail.code === "audio_invalid") {
          this.state.fail = null;
          throw new AppError("audio_invalid", undefined, { slide_index: declared[0]!.slide_index, reason: "not_16khz_mono_16bit" });
        }
        this.setSession(s, { status: "transcribing", analysis_stage: "Transcribing your recording", analysis_attempts: s.analysis_attempts + 1, error_code: null });
        void this.runAnalysis(sessionId);
        return { session_id: sessionId, status: "transcribing" as const };
      }),
    },
    reports: {
      get: (reportId) => this.call((): ReportDetail => {
        const u = this.me();
        const r = this.state.reports.find((x) => x.id === reportId && x.owner_id === u.id);
        if (!r) throw new AppError("not_found");
        const deck = this.state.decks.find((d) => d.id === r.deck_id);
        const slides = this.state.slides.filter((s) => s.deck_id === r.deck_id).sort((a, b) => a.slide_index - b.slide_index);
        const session = this.state.sessions.find((s) => s.id === r.session_id);
        const rating = this.state.ratings.find((x) => x.report_id === reportId);
        return {
          report: r, deck_title: deck?.title ?? "Deck", deck_id: r.deck_id, target_seconds: (session?.suggested_seconds ?? []).reduce((a, b) => a + b, 0),
          slides: slides.map((s) => ({ slide_index: s.slide_index, title: s.title, key_points: s.key_points })),
          results: this.state.results.filter((x) => x.session_id === r.session_id).sort((a, b) => a.slide_index - b.slide_index),
          rating: rating ? { stars: rating.stars, comment: rating.comment } : null,
        };
      }),
      getBySession: (sessionId) => this.call(() => { const r = this.state.reports.find((x) => x.session_id === sessionId && x.owner_id === this.me().id); if (!r) throw new AppError("not_found"); return { report_id: r.id }; }),
      rate: (reportId, stars, comment) => this.call((): RatingRow => {
        this.assertCanPractise({ limit: false });
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError("invalid_stars");
        const c = comment?.trim() || null;
        if (c && c.length > 500) throw new AppError("comment_too_long");
        const u = this.state.user;
        if (!this.state.reports.some((r) => r.id === reportId && r.owner_id === u.id)) throw new AppError("not_found");
        if (this.state.ratings.some((r) => r.report_id === reportId)) throw new AppError("already_rated");
        const row: RatingRow = { id: uuid(), report_id: reportId, user_id: u.id, stars, comment: c, created_at: iso(this.now()) };
        this.state.ratings.push(row);
        const rep = this.state.reports.find((r) => r.id === reportId)!;
        this.state.adminRatings.unshift({ student_name: u.fullName ?? u.email, user_id: u.id, deck_title: this.state.decks.find((d) => d.id === rep.deck_id)?.title ?? "Deck", stars, comment: c, date: row.created_at });
        this.touch();
        return row;
      }),
    },
    realtime: {
      subscribeDeck: (id, cb) => this.sub(this.deckSubs, id, cb),
      subscribeSession: (id, cb) => this.sub(this.sessionSubs, id, cb),
    },
    account: {
      delete: (confirm) => this.call(() => {
        const u = this.me();
        if (u.role === "admin") throw new AppError("is_admin");
        if (confirm !== "DELETE") throw new AppError("unknown", "Type DELETE to confirm.");
        this.blobs.clear();
        this.state = seedState("signed_out");
        this.touch();
        this.authSubs.forEach((cb) => cb(null));
        return { deleted: true as const, storage_cleanup: "complete" as const };
      }),
    },
    admin: {
      overview: () => this.call((): AdminOverview => {
        this.requireAdmin();
        const credits = Object.values(this.state.aiSlots).flat().reduce((a, s) => a + s.used, 0);
        return { total_students: 412, sessions_last_14_days: this.state.sessionsPerDay.reduce((a, b) => a + b, 0), sessions_all_time: 1086, average_rating: 4.2, ratings_count: 318, ai_credits_used: credits };
      }),
      sessionsPerDay: (days) => this.call((): SessionsPerDay[] => {
        this.requireAdmin();
        const n = Math.max(1, Math.min(days, this.state.sessionsPerDay.length));
        const vals = this.state.sessionsPerDay.slice(-n);
        return vals.map((count, i) => ({ day: istDateString(new Date(this.now().getTime() - (vals.length - 1 - i) * 86_400_000)), count }));
      }),
      listStudents: (input) => this.call((): AdminStudent[] => {
        this.requireAdmin();
        const q = (input.search ?? "").trim().toLowerCase();
        const all = this.state.students.filter((s) => !q || `${s.name} ${s.email} ${s.college}`.toLowerCase().includes(q)).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
        const limit = input.limit ?? 25, offset = input.offset ?? 0;
        return all.slice(offset, offset + limit).map((s) => ({ user_id: s.id, full_name: s.name, email: s.email, college: s.college, year: s.year, branch: s.branch, avatar_url: null, attempts: s.attempts, last_active_at: s.lastActiveAt, average_score: s.avg, is_blocked: s.blocked, total_count: all.length }));
      }),
      studentDetail: (userId) => this.call((): AdminStudentDetail => {
        this.requireAdmin();
        const s = this.state.students.find((x) => x.id === userId);
        if (!s) throw new AppError("not_found");
        const base = new Date(this.now().getTime() - 3 * 86_400_000);
        const attempts = s.attempts === 0 ? [] : s.name === "Ananya Rao"
          ? [{ report_id: "r2", deck_title: "ParkSense hackathon pitch", attempt_number: 2, date: "2026-10-02T14:20:00Z", overall_score: 74 }, { report_id: "r1", deck_title: "ParkSense hackathon pitch", attempt_number: 1, date: "2026-10-02T09:45:00Z", overall_score: 62 }]
          : [{ report_id: `${s.id}-2`, deck_title: "Seminar: Edge AI", attempt_number: 2, date: iso(base), overall_score: (s.avg ?? 60) + 4 }, { report_id: `${s.id}-1`, deck_title: "Seminar: Edge AI", attempt_number: 1, date: iso(new Date(base.getTime() - 2 * 86_400_000)), overall_score: (s.avg ?? 60) - 4 }];
        return {
          profile: { user_id: s.id, full_name: s.name, email: s.email, college: s.college, year: s.year, branch: s.branch, avatar_url: null, is_blocked: s.blocked, last_active_at: s.lastActiveAt, created_at: "2026-05-01T09:00:00Z" },
          attempts, ratings: this.state.adminRatings.filter((r) => r.user_id === s.id).map((r) => ({ deck_title: r.deck_title, stars: r.stars, comment: r.comment, date: r.date })),
        };
      }),
      setBlocked: (userId, blocked) => this.call(() => {
        this.requireAdmin();
        const s = this.state.students.find((x) => x.id === userId);
        if (!s) throw new AppError("not_found");
        s.blocked = blocked;
        this.touch();
      }),
      ratings: (stars) => this.call((): AdminRatings => {
        this.requireAdmin();
        const all = this.state.adminRatings;
        return { average: all.length ? Math.round((all.reduce((a, r) => a + r.stars, 0) / all.length) * 100) / 100 : null, count: all.length, rows: all.filter((r) => !stars || r.stars === stars).sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      aiUsage: (days) => this.call((): AdminAiUsage => {
        this.requireAdmin();
        const nowMs = this.now().getTime();
        return {
          purposes: PURPOSES.map((purpose: Purpose) => {
            const series = (this.state.aiPerDay[purpose] ?? []).slice(-days);
            return {
              purpose,
              slots: this.state.aiSlots[purpose].map((k) => ({ slot_id: k.slot_id, slot: k.slot, credit_limit: k.credit_limit, used: k.used, remaining: Math.max(k.credit_limit - k.used, 0), percent_used: k.credit_limit ? Math.round((1000 * k.used) / k.credit_limit) / 10 : 100, running_low: k.credit_limit === 0 || (100 * k.used) / k.credit_limit > 75, cooldown_until: k.cooldown_until, last_error_code: k.last_error_code })),
              per_day: series.map((count, i) => ({ date: istDateString(new Date(nowMs - (series.length - 1 - i) * 86_400_000)), count })),
            };
          }),
        };
      }),
      aiKeys: () => this.call((): AdminAiKeys => {
        this.requireAdmin();
        return { purposes: PURPOSES.map((purpose: Purpose) => ({ purpose, model: this.state.aiModels[purpose] ?? "", slots: this.state.aiSlots[purpose].map((k) => ({ slot_id: k.slot_id, slot: k.slot, configured: k.configured, masked: k.masked })) })) };
      }),
      policyVersions: () => this.call((): AdminPolicyVersion[] => {
        this.requireAdmin();
        const sorted = [...this.state.policies].sort((a, b) => b.published_at.localeCompare(a.published_at));
        return sorted.map((p, i) => ({ id: p.id, version_label: p.version_label, note: p.note, published_at: p.published_at, published_by: p.published_by, is_live: i === 0, terms_body: p.terms_body, privacy_body: p.privacy_body }));
      }),
      publishPolicy: (input) => this.call(() => {
        const u = this.requireAdmin();
        const label = input.version_label.trim();
        if (!/^v\d+(\.\d+)?$/.test(label)) throw new AppError("invalid_label", "Use a label like v4.0");
        if (!input.terms_body.trim() || !input.privacy_body.trim()) throw new AppError("invalid_body", "Both texts are required.");
        const parse = (l: string) => l.slice(1).split(".").map(Number);
        const cur = parse(this.latestPolicy().version_label), nxt = parse(label);
        const bigger = (nxt[0]! - cur[0]!) || ((nxt[1] ?? 0) - (cur[1] ?? 0));
        if (bigger <= 0) throw new AppError("label_not_increasing", "The label must come after the current version.");
        const row = { id: uuid(), version_label: label, terms_body: input.terms_body, privacy_body: input.privacy_body, note: input.note?.trim() || null, published_at: iso(this.now()), published_by: u.id };
        this.state.policies.push(row);
        this.touch();
        return row;
      }),
    },
  };

  private authSession(): AuthSession | null {
    if (!this.state.signedIn) return null;
    const u = this.state.user;
    return { userId: u.id, email: u.email, fullName: u.fullName, avatarUrl: u.avatarUrl, role: u.role };
  }

  private sub<E>(map: Map<string, Set<(e: E) => void>>, id: string, cb: (e: E) => void): Unsubscribe {
    let set = map.get(id);
    if (!set) map.set(id, (set = new Set()));
    set.add(cb);
    return () => { set!.delete(cb); };
  }

  // ---------------------------------------------------------------- persona switching (dev panel / tests)
  /** Re-seeds the user-specific data but keeps the shared world (policy versions, admin data) so cross-persona effects stay visible. */
  switchPersona(id: PersonaId, signedIn?: boolean) {
    const prev = this.state;
    const next = seedState(id);
    next.policies = prev.policies;
    next.students = prev.students; next.adminRatings = prev.adminRatings; next.sessionsPerDay = prev.sessionsPerDay; next.aiSlots = prev.aiSlots; next.aiPerDay = prev.aiPerDay;
    next.nextSignIn = prev.nextSignIn;
    next.fail = null;
    if (id !== "signed_out" && id !== "new_student" && id !== "admin") { /* seeded users accepted the policies they had seen at seed time only */ next.acceptedPolicyIds = next.acceptedPolicyIds.filter((x) => prev.policies.some((p) => p.id === x)); }
    this.blobs.clear();
    this.state = next;
    if (signedIn !== undefined) this.state.signedIn = signedIn;
    this.touch();
    this.authSubs.forEach((cb) => cb(this.authSession()));
  }

  readonly control: MockControl = {
    getPersona: () => this.state.persona,
    setPersona: (id) => this.switchPersona(id),
    setNextSignIn: (id) => { this.state.nextSignIn = id; this.touch(); },
    reset: () => { const p = this.state.persona; this.state.policies = seedState(p).policies; this.switchPersona(p); },
    republishPolicy: () => {
      const cur = this.latestPolicy();
      const [maj, min] = cur.version_label.slice(1).split(".").map(Number);
      this.state.policies.push({ id: uuid(), version_label: `v${maj}.${(min ?? 0) + 1}`, terms_body: TERMS_V3, privacy_body: this.latestPolicy().privacy_body, note: "Republished from the mock control panel", published_at: iso(this.now()), published_by: null });
      this.touch();
    },
    failNext: (plan) => { this.state.fail = plan; this.touch(); },
    failNextPuts: (n) => { this.blobs.failNextPuts = n; },
    breakAssetUrlsOnce: () => { this.breakUrls = true; },
    getConfig: () => ({ ...this.cfg }),
    setConfig: (p) => { Object.assign(this.cfg, p); this.blobs.stepDelayMs = this.cfg.latencyMs > 0 ? 40 : 0; try { this.opts.storage?.setItem(STORAGE_KEYS.config, JSON.stringify(this.cfg)); } catch { /* ignore */ } this.touch(); },
    subscribe: (cb) => { this.changeSubs.add(cb); return () => this.changeSubs.delete(cb); },
    snapshot: () => clone(this.state),
  };
}

