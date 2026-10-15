// DataPort backed by Supabase (RLS reads, RPCs, Edge Functions) — mapping table in docs/phase-3/integration.md.
// Behavioural reference for every method: the mock adapter (lib/data/mock/adapter.ts).
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Supa } from "@/lib/supabase/browser";
import { AppError } from "../errors";
import type {
  AdminAiKeys, AdminAiUsage, AdminOverview, AdminPolicyVersion, AdminRatings, AdminStudent, AdminStudentDetail, AuthSession, DashboardStats, DataPort, DeckAttempt, DeckDetail,
  DeckEvent, DeckRow, DeckSummary, PolicyVersionRow, ProfileRow, RatingRow, ReportDetail, ReportListItem, SessionEvent, SessionRow, SessionsPerDay, SlideRow, Unsubscribe,
} from "../types";
import { fromAuth, fromPostgrest } from "./errors";
import * as S from "./schemas";
import { parse } from "./schemas";
import { createTransport, type Transport, type TransportOptions } from "./transport";

export type SupabaseDataOptions = Omit<TransportOptions, "supa"> & { supa: Supa; appUrl: string };

const DECK_EVENT_COLS = "id,status,processing_stage,processed_slides,error_code,page_count";
const SESSION_EVENT_COLS = "id,status,analysis_stage,error_code";
 
const one = (v: unknown): any => (Array.isArray(v) ? v[0] : undefined);

export function createSupabaseData(opts: SupabaseDataOptions): DataPort & { transport: Transport } {
  const t = createTransport(opts);
  const { supa } = t;
  const arr = <T,>(schema: { parse(x: unknown): T }, label: string) => (data: unknown): T[] => (Array.isArray(data) ? data.map((r, i) => parse(schema as never, r, `${label}[${i}]`) as T) : []);

  // ---------------------------------------------------------------- auth
  const uid = async (): Promise<string> => {
    const { data, error } = await supa.auth.getSession();
    if (error || !data.session) throw new AppError("not_authenticated");
    return data.session.user.id;
  };

  async function readSession(): Promise<AuthSession | null> {
    const { data: s, error } = await supa.auth.getSession();
    if (error || !s.session) return null;
    // Role and profile come from the server: the profile is read under RLS, which makes PostgREST validate the JWT (an invalid or revoked
    // token fails here), so no separate getUser() round trip is needed. Claims in the token are never used to decide the role.
    const user = s.session.user;
    const prof = await t.db(() => supa.from("profiles").select("role,full_name,avatar_url,email").eq("id", user.id).maybeSingle());
    if (!prof) return null; // signed in but the profile row does not exist (yet): treated as signed out
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return {
      userId: user.id, email: prof.email ?? user.email ?? "", role: prof.role === "admin" ? "admin" : "student",
      fullName: prof.full_name ?? (typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null),
      avatarUrl: prof.avatar_url ?? (typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null),
    };
  }

  // ---------------------------------------------------------------- realtime
  const channels = new Set<RealtimeChannel>();
  function subscribeRow<E>(table: "decks" | "practice_sessions", id: string, pick: (row: Record<string, unknown>) => E, cb: (e: E) => void): Unsubscribe {
    const ch = supa.channel(`${table}:${id}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `id=eq.${id}` }, (p) => { if (p.new && typeof p.new === "object") cb(pick(p.new as Record<string, unknown>)); })
      .subscribe();
    channels.add(ch);
    return () => { channels.delete(ch); void supa.removeChannel(ch); };
  }
  const deckEvent = (r: Record<string, unknown>): DeckEvent => ({
    id: String(r.id), status: String(r.status) as DeckRow["status"], processing_stage: (r.processing_stage as string | null) ?? null,
    processed_slides: Number(r.processed_slides ?? 0), error_code: (r.error_code as string | null) ?? null, page_count: r.page_count == null ? null : Number(r.page_count),
  });
  const sessionEvent = (r: Record<string, unknown>): SessionEvent => ({
    id: String(r.id), status: String(r.status) as SessionRow["status"], analysis_stage: (r.analysis_stage as string | null) ?? null, error_code: (r.error_code as string | null) ?? null,
  });

  // ---------------------------------------------------------------- helpers shared by methods
  const reportIdFor = async (sessionId: string): Promise<string | null> => {
    const r = await t.db(() => supa.from("reports").select("id").eq("session_id", sessionId).maybeSingle());
    return r?.id ?? null;
  };
  const deckById = async (deckId: string): Promise<DeckRow> => parse(S.deckRow, await t.db(() => supa.from("decks").select("*").eq("id", deckId).single()), "decks") as unknown as DeckRow;

  const port: DataPort = {
    auth: {
      getSession: () => readSession(),
      onChange: (cb) => {
        let last: string | null | undefined;
        const { data } = supa.auth.onAuthStateChange((event, session) => {
          // Keep Realtime authorised across token refreshes; refreshes are not an "auth change" for the UI (they must not wipe the cache).
          if (session?.access_token) supa.realtime.setAuth(session.access_token);
          const id = session?.user.id ?? null;
          if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || id === last) return;
          last = id;
          // Never await supabase calls inside this callback (deadlock risk): defer.
          setTimeout(() => { if (!id) cb(null); else readSession().then(cb).catch(() => cb(null)); }, 0);
        });
        return () => data.subscription.unsubscribe();
      },
      signInWithGoogle: async (o) => {
        const next = o?.next && o.next.startsWith("/") ? o.next : undefined;
        const redirectTo = `${opts.appUrl.replace(/\/$/, "")}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
        const { error } = await supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
        if (error) throw fromAuth(error);
        await new Promise<void>(() => { /* the browser is navigating to Google: keep the button in its pending state */ });
      },
      peek: () => typeof document !== "undefined" && /(?:^|;\s*)sb-[^=;]+-auth-token/.test(document.cookie),
      signOut: async () => {
        for (const ch of channels) void supa.removeChannel(ch);
        channels.clear();
        const { error } = await supa.auth.signOut();
        if (error) await supa.auth.signOut({ scope: "local" });
      },
    },

    profile: {
      getMine: async () => { const id = await uid(); return parse(S.profileRow, await t.db(() => supa.from("profiles").select("*").eq("id", id).single()), "profiles") as unknown as ProfileRow; },
      update: async (input) => {
        const id = await uid();
        const patch: Record<string, string> = { college: input.college.trim(), year: input.year, branch: input.branch };
        if (input.full_name !== undefined) patch.full_name = input.full_name;
        const rows = await t.db(() => supa.from("profiles").update(patch as never).eq("id", id).select("*"));
        const row = one(rows);
        if (!row) throw new AppError("blocked"); // column grants + RLS: a blocked student's update matches no row
        return parse(S.profileRow, row, "profiles") as unknown as ProfileRow;
      },
    },

    policy: {
      getLatest: async () => parse(S.policyRow, await t.db(() => supa.from("policy_versions").select("*").order("published_at", { ascending: false }).limit(1).single()), "policy_versions") as unknown as PolicyVersionRow,
      hasAcceptedLatest: async () => (await t.rpc<boolean>("has_accepted_latest_policy")) === true,
      listAccepted: async () => (await t.db(() => supa.from("policy_acceptances").select("policy_version_id"))).map((r: { policy_version_id: string }) => r.policy_version_id),
      accept: async (versionId) => { await t.rpc("accept_policy", { p_version_id: versionId }); },
    },

    dashboard: {
      getStats: async (): Promise<DashboardStats> => parse(S.dashboardStats, one(await t.rpc<unknown[]>("my_dashboard_stats")), "my_dashboard_stats") as unknown as DashboardStats,
      listRecentReports: async (limit): Promise<ReportListItem[]> => {
        const rows = await t.db(() => supa.from("reports").select("id,deck_id,overall_score,attempt_number,created_at,decks(title)").order("created_at", { ascending: false }).limit(limit));
        return arr(S.recentReport, "reports")(rows).map((r) => ({ report_id: r.id, deck_id: r.deck_id, deck_title: r.decks?.title ?? "Deck", overall_score: r.overall_score, attempt_number: r.attempt_number, created_at: r.created_at }));
      },
    },

    decks: {
      list: async (): Promise<DeckSummary[]> => arr(S.deckSummary, "my_decks")(await t.rpc<unknown[]>("my_decks")) as unknown as DeckSummary[],
      get: async (deckId): Promise<DeckDetail> => {
        const [deck, slides, last] = await Promise.all([
          deckById(deckId),
          t.db(() => supa.from("slides").select("*").eq("deck_id", deckId).order("slide_index")),
          t.db(() => supa.from("practice_sessions").select("total_minutes,suggested_seconds").eq("deck_id", deckId).neq("status", "abandoned").order("attempt_number", { ascending: false }).limit(1)),
        ]);
        const l = one(last);
        const suggested = (l?.suggested_seconds as number[] | undefined) ?? null;
        return { deck, slides: arr(S.slideRow, "slides")(slides) as unknown as SlideRow[], latest_total_minutes: l?.total_minutes ?? null, total_target_seconds: suggested ? suggested.reduce((a, b) => a + b, 0) : null };
      },
      attempts: async (deckId): Promise<DeckAttempt[]> => arr(S.deckAttempt, "my_deck_detail")(await t.rpc<unknown[]>("my_deck_detail", { p_deck_id: deckId })) as unknown as DeckAttempt[],
      setPinned: async (deckId, pinned) => { await t.rpc("set_deck_pinned", { p_deck_id: deckId, p_pinned: pinned }); },
      getAssetUrls: async (deckId, kinds) => parse(S.assetUrls, await t.fn("asset-urls", { deck_id: deckId, kinds }), "asset-urls") as never,
      getStatus: async (deckId): Promise<DeckEvent> => deckEvent(await t.db(() => supa.from("decks").select(DECK_EVENT_COLS).eq("id", deckId).single()) as Record<string, unknown>),
    },

    upload: {
      init: async (input) => parse(S.uploadInit, await t.fn("deck-upload-init", input), "deck-upload-init") as never,
      complete: async (deckId) => parse(S.uploadComplete, await t.fn("deck-upload-complete", { deck_id: deckId }), "deck-upload-complete") as never,
      process: async (deckId) => parse(S.processResult, await t.fn("deck-process", { deck_id: deckId }), "deck-process") as never,
    },

    sessions: {
      start: async (deckId, totalMinutes) => parse(S.sessionRow, await t.rpc("start_practice_session", { p_deck_id: deckId, p_total_minutes: totalMinutes }), "start_practice_session") as unknown as SessionRow,
      get: async (sessionId) => {
        const r = await t.db(() => supa.from("practice_sessions").select(`${SESSION_EVENT_COLS},deck_id,attempt_number,total_minutes,suggested_seconds`).eq("id", sessionId).single());
        const ev = sessionEvent(r as Record<string, unknown>);
        if (ev.status === "completed") ev.report_id = await reportIdFor(sessionId);
        return { ...ev, deck_id: r.deck_id, attempt_number: Number(r.attempt_number), total_minutes: Number(r.total_minutes), suggested_seconds: (r.suggested_seconds as number[]).map(Number) };
      },
      getOpenForDeck: async (deckId) => {
        const rows = await t.db(() => supa.from("practice_sessions").select("*").eq("deck_id", deckId).in("status", ["in_progress", "failed", "uploading_audio"]).order("created_at", { ascending: false }).limit(1));
        const r = one(rows);
        return r ? (parse(S.sessionRow, r, "practice_sessions") as unknown as SessionRow) : null;
      },
      submitInit: async (sessionId, clips) => parse(S.submitInit, await t.fn("session-submit-init", { session_id: sessionId, clips }), "session-submit-init") as never,
      analyse: async (sessionId) => parse(S.analyseResult, await t.fn("session-analyse", { session_id: sessionId }), "session-analyse") as never,
    },

    reports: {
      get: async (reportId): Promise<ReportDetail> => {
        const report = parse(S.reportRow, await t.db(() => supa.from("reports").select("*").eq("id", reportId).single()), "reports");
        const [results, slides, deck, session, rating] = await Promise.all([
          t.db(() => supa.from("session_slide_results").select("*").eq("session_id", report.session_id).order("slide_index")),
          t.db(() => supa.from("slides").select("slide_index,title,key_points").eq("deck_id", report.deck_id).order("slide_index")),
          t.db(() => supa.from("decks").select("title").eq("id", report.deck_id).maybeSingle()),
          t.db(() => supa.from("practice_sessions").select("suggested_seconds").eq("id", report.session_id).maybeSingle()),
          t.db(() => supa.from("report_ratings").select("stars,comment").eq("report_id", reportId).maybeSingle()),
        ]);
        return {
          report: report as unknown as ReportDetail["report"],
          results: arr(S.resultRow, "session_slide_results")(results) as unknown as ReportDetail["results"],
          slides: (slides ?? []).map((s: { slide_index: unknown; title: string | null; key_points: string[] }) => ({ slide_index: Number(s.slide_index), title: s.title, key_points: s.key_points })),
          deck_title: deck?.title ?? "Deck", deck_id: report.deck_id,
          target_seconds: ((session?.suggested_seconds as number[] | undefined) ?? []).reduce((a, b) => a + Number(b), 0),
          rating: rating ? { stars: Number(rating.stars), comment: rating.comment } : null,
        };
      },
      getBySession: async (sessionId) => { const id = await reportIdFor(sessionId); if (!id) throw new AppError("not_found"); return { report_id: id }; },
      rate: async (reportId, stars, comment) => parse(S.ratingRow, await t.rpc("rate_report", { p_report_id: reportId, p_stars: stars, ...(comment?.trim() ? { p_comment: comment.trim() } : {}) }), "rate_report") as unknown as RatingRow,
    },

    realtime: {
      subscribeDeck: (id, cb) => subscribeRow("decks", id, deckEvent, cb),
      subscribeSession: (id, cb) => subscribeRow("practice_sessions", id, sessionEvent, (e) => {
        if (e.status !== "completed") return cb(e);
        void reportIdFor(id).then((rid) => cb({ ...e, report_id: rid })).catch(() => cb(e));
      }),
    },

    account: {
      delete: async (confirm) => {
        const r = parse(S.accountDelete, await t.fn("account-delete", { confirm }), "account-delete");
        await supa.auth.signOut({ scope: "local" }); // the auth user is gone server-side; clear the local cookie session
        return r as never;
      },
    },

    admin: {
      overview: async (): Promise<AdminOverview> => parse(S.adminOverview, one(await t.rpc<unknown[]>("admin_overview")), "admin_overview") as unknown as AdminOverview,
      sessionsPerDay: async (days): Promise<SessionsPerDay[]> => arr(S.sessionsPerDay, "admin_sessions_per_day")(await t.rpc<unknown[]>("admin_sessions_per_day", { p_days: days })),
      listStudents: async (input): Promise<AdminStudent[]> => arr(S.adminStudent, "admin_list_students")(await t.rpc<unknown[]>("admin_list_students", { p_search: input.search?.trim() || null, p_limit: input.limit ?? 50, p_offset: input.offset ?? 0 })) as unknown as AdminStudent[],
      studentDetail: async (userId): Promise<AdminStudentDetail> => parse(S.adminStudentDetail, await t.rpc("admin_student_detail", { p_user_id: userId }), "admin_student_detail") as unknown as AdminStudentDetail,
      setBlocked: async (userId, blocked) => { await t.rpc("admin_set_blocked", { p_user_id: userId, p_blocked: blocked }); },
      ratings: async (stars): Promise<AdminRatings> => parse(S.adminRatings, await t.rpc("admin_ratings", { p_stars: stars ?? null }), "admin_ratings") as unknown as AdminRatings,
      aiUsage: async (days): Promise<AdminAiUsage> => parse(S.adminAiUsage, await t.rpc("admin_ai_usage", { p_days: days }), "admin_ai_usage") as unknown as AdminAiUsage,
      aiKeys: async (): Promise<AdminAiKeys> => parse(S.adminAiKeys, await t.fn("admin-ai-keys", {}), "admin-ai-keys") as unknown as AdminAiKeys,
      policyVersions: async (): Promise<AdminPolicyVersion[]> => arr(S.adminPolicyVersion, "admin_policy_versions")(await t.rpc<unknown[]>("admin_policy_versions")) as unknown as AdminPolicyVersion[],
      publishPolicy: async (input) => parse(S.policyRow, await t.rpc("admin_publish_policy", { p_version_label: input.version_label.trim(), p_terms_body: input.terms_body, p_privacy_body: input.privacy_body, ...(input.note?.trim() ? { p_note: input.note.trim() } : {}) }), "admin_publish_policy") as unknown as PolicyVersionRow,
    },
  };
  return Object.assign(port, { transport: t });
}

export { fromPostgrest };
