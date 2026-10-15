import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseData } from "@/lib/data/supabase/adapter";
import { fromAuth, fromFunctionResponse, fromPostgrest } from "@/lib/data/supabase/errors";
import { createTransport } from "@/lib/data/supabase/transport";
import { AppError } from "@/lib/data/errors";
import type { Supa } from "@/lib/supabase/browser";

type Reply = { data: unknown; error?: { message?: string; code?: string } | null };

/** A chainable PostgREST stub: every builder method returns itself; awaiting it yields the queued reply for that table. */
function fakeSupa(o: {
  tables?: Record<string, Reply | Reply[]>; rpc?: Record<string, Reply | Reply[]>; session?: unknown; user?: unknown; refreshed?: unknown;
}) {
  const calls: string[] = [];
  const take = (m: Record<string, Reply | Reply[]> | undefined, k: string): Reply => {
    const v = m?.[k];
    if (Array.isArray(v)) return v.length > 1 ? v.shift()! : v[0]!;
    return v ?? { data: null, error: { message: `no stub for ${k}` } };
  };
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "update", "eq", "neq", "in", "order", "limit", "match"]) b[m] = (...a: unknown[]) => { calls.push(`${table}.${m}(${a.map((x) => JSON.stringify(x)).join(",")})`); return b; };
    b.single = () => Promise.resolve(take(o.tables, table));
    b.maybeSingle = () => Promise.resolve(take(o.tables, table));
    b.then = (res: (r: Reply) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(take(o.tables, table)).then(res, rej);
    return b;
  };
  const authHandlers: ((e: string, s: unknown) => void)[] = [];
  const channels: { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn>; handler?: (p: unknown) => void }[] = [];
  let session = o.session === undefined ? { access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u1", email: "a@b.c", user_metadata: { name: "Meta Name", picture: "http://pic" } } } : o.session;
  const supa = {
    from: (t: string) => builder(t),
    rpc: (name: string, args: unknown) => { calls.push(`rpc.${name}(${JSON.stringify(args)})`); return Promise.resolve(take(o.rpc, name)); },
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      refreshSession: vi.fn(() => { session = o.refreshed ?? { access_token: "tok2", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u1" } }; return Promise.resolve({ data: { session }, error: null }); }),
      getUser: () => Promise.resolve({ data: { user: o.user ?? { id: "u1" } }, error: null }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => { authHandlers.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; },
      signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    realtime: { setAuth: vi.fn() },
    channel: (name: string) => {
      const ch = { name, on: vi.fn(), subscribe: vi.fn(), handler: undefined as undefined | ((p: unknown) => void) };
      ch.on.mockImplementation((_t: string, _f: unknown, h: (p: unknown) => void) => { ch.handler = h; return ch; });
      ch.subscribe.mockImplementation(() => ch);
      channels.push(ch);
      return ch;
    },
    removeChannel: vi.fn(() => Promise.resolve("ok")),
  };
  return { supa: supa as unknown as Supa, raw: supa, calls, authHandlers, channels };
}

const mkData = (s: ReturnType<typeof fakeSupa>, fetchFn?: typeof fetch) =>
  createSupabaseData({ supa: s.supa, functionsUrl: "https://x.supabase.co/functions/v1", anonKey: "anon", appUrl: "https://app.test", fetch: fetchFn });
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("error normalisation", () => {
  it("maps RPC exception messages that are known codes", () => {
    expect(fromPostgrest({ message: "daily_limit_reached" }).code).toBe("daily_limit_reached");
    expect(fromPostgrest({ message: "already_rated" }).code).toBe("already_rated");
    expect(fromPostgrest({ message: "label_not_increasing" }).code).toBe("label_not_increasing");
  });
  it("maps permission, jwt, no-row and transport failures", () => {
    expect(fromPostgrest({ code: "42501", message: "permission denied" }).code).toBe("forbidden");
    expect(fromPostgrest({ code: "PGRST301", message: "JWT expired" }).code).toBe("not_authenticated");
    expect(fromPostgrest({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }).code).toBe("not_found");
    expect(fromPostgrest({ message: "TypeError: Failed to fetch" }).code).toBe("network_error");
  });
  it("never leaks an unknown backend message", () => {
    const e = fromPostgrest({ message: "relation \"x\" does not exist at character 14" });
    expect(e.code).toBe("unknown");
    expect(e.message).not.toMatch(/relation/);
    expect(fromPostgrest({ message: "some_new_code" }).details).toEqual({ backend_code: "some_new_code" });
  });
  it("maps Edge Function envelopes and gateway errors", () => {
    const e = fromFunctionResponse(400, { ok: false, error: { code: "too_many_pages", message: "That deck has 11 slides", page_count: 11, max_pages: 10 } });
    expect(e.code).toBe("too_many_pages"); expect(e.details).toEqual({ page_count: 11, max_pages: 10 });
    expect(fromFunctionResponse(429, { ok: false, error: { code: "daily_limit_reached", message: "x" } }).code).toBe("daily_limit_reached");
    expect(fromFunctionResponse(401, { code: 401, message: "Invalid JWT" }).code).toBe("not_authenticated");
    expect(fromFunctionResponse(500, null).code).toBe("unknown");
    expect(fromFunctionResponse(413, "x").code).toBe("too_large");
  });
  it("maps auth errors", () => {
    expect(fromAuth({ message: "Failed to fetch" }).code).toBe("network_error");
    expect(fromAuth({ message: "Invalid Refresh Token" }).code).toBe("not_authenticated");
  });
});

describe("transport", () => {
  it("sends the user JWT + apikey and unwraps the envelope", async () => {
    const s = fakeSupa({});
    const f = vi.fn(async () => jsonRes(200, { ok: true, data: { deck_id: "d1" } }));
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "anon", fetch: f as never });
    expect(await t.fn("deck-process", { deck_id: "d1" })).toEqual({ deck_id: "d1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://f/deck-process");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>).apikey).toBe("anon");
  });
  it("202 responses count as success", async () => {
    const s = fakeSupa({});
    const f = vi.fn(async () => jsonRes(202, { ok: true, data: { status: "processing" } }));
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a", fetch: f as never });
    expect(await t.fn("deck-process", {})).toEqual({ status: "processing" });
  });
  it("refreshes the token once on a 401 and retries", async () => {
    const s = fakeSupa({});
    const f = vi.fn().mockResolvedValueOnce(jsonRes(401, { code: 401, message: "Invalid JWT" })).mockResolvedValueOnce(jsonRes(200, { ok: true, data: 1 }));
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a", fetch: f as never });
    expect(await t.fn("x", {})).toBe(1);
    expect(s.raw.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[1]![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok2" });
  });
  it("gives up after one refresh (no loops)", async () => {
    const s = fakeSupa({});
    const f = vi.fn(async () => jsonRes(401, { code: 401, message: "Invalid JWT" }));
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a", fetch: f as never });
    await expect(t.fn("x", {})).rejects.toMatchObject({ code: "not_authenticated" });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("proactively refreshes a token that expires within 60 s", async () => {
    const s = fakeSupa({ session: { access_token: "old", expires_at: Math.floor(Date.now() / 1000) + 20, user: { id: "u1" } } });
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a", fetch: (async () => jsonRes(200, { ok: true, data: 0 })) as never });
    await t.fn("x", {});
    expect(s.raw.auth.refreshSession).toHaveBeenCalledTimes(1);
  });
  it("network failure → network_error; no session → not_authenticated", async () => {
    const s = fakeSupa({});
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a", fetch: (async () => { throw new TypeError("Failed to fetch"); }) as never });
    await expect(t.fn("x", {})).rejects.toMatchObject({ code: "network_error" });
    const s2 = fakeSupa({ session: null });
    const t2 = createTransport({ supa: s2.supa, functionsUrl: "https://f", anonKey: "a", fetch: (async () => jsonRes(200, {})) as never });
    await expect(t2.token()).rejects.toMatchObject({ code: "not_authenticated" });
  });
  it("rpc: retries once after a JWT error, surfaces our codes", async () => {
    const s = fakeSupa({ rpc: { start_practice_session: [{ data: null, error: { code: "PGRST301", message: "JWT expired" } }, { data: { ok: 1 } }], rate_report: { data: null, error: { message: "already_rated" } } } });
    const t = createTransport({ supa: s.supa, functionsUrl: "https://f", anonKey: "a" });
    expect(await t.rpc("start_practice_session", {})).toEqual({ ok: 1 });
    await expect(t.rpc("rate_report", {})).rejects.toMatchObject({ code: "already_rated" });
  });
});

const profile = { id: "u1", email: "a@b.c", full_name: null, avatar_url: null, role: "student" };

describe("adapter: auth", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("builds the session from the server profile (role from the row, name/avatar fallbacks from metadata)", async () => {
    const d = mkData(fakeSupa({ tables: { profiles: { data: profile } } }));
    expect(await d.auth.getSession()).toEqual({ userId: "u1", email: "a@b.c", role: "student", fullName: "Meta Name", avatarUrl: "http://pic" });
  });
  it("admin role comes from profiles.role", async () => {
    const d = mkData(fakeSupa({ tables: { profiles: { data: { ...profile, role: "admin" } } } }));
    expect((await d.auth.getSession())?.role).toBe("admin");
  });
  it("no session / no profile row → null", async () => {
    expect(await mkData(fakeSupa({ session: null })).auth.getSession()).toBeNull();
    expect(await mkData(fakeSupa({ tables: { profiles: { data: null } } })).auth.getSession()).toBeNull();
  });
  it("onChange: refreshes re-authorise realtime but do not notify; sign-out notifies null once", async () => {
    vi.useFakeTimers();
    const s = fakeSupa({ tables: { profiles: { data: profile } } });
    const d = mkData(s); const cb = vi.fn();
    d.auth.onChange(cb);
    const h = s.authHandlers[0]!;
    h("SIGNED_IN", { access_token: "t1", user: { id: "u1" } }); await vi.runAllTimersAsync();
    h("TOKEN_REFRESHED", { access_token: "t2", user: { id: "u1" } }); await vi.runAllTimersAsync();
    h("SIGNED_IN", { access_token: "t3", user: { id: "u1" } }); await vi.runAllTimersAsync(); // same user again (tab refocus)
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.raw.realtime.setAuth).toHaveBeenLastCalledWith("t3");
    h("SIGNED_OUT", null); await vi.runAllTimersAsync();
    expect(cb).toHaveBeenCalledTimes(2); expect(cb).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });
  it("Google sign-in uses the callback URL with a safe next and never resolves (the browser navigates away)", async () => {
    const s = fakeSupa({}); const d = mkData(s);
    let settled = false;
    void d.auth.signInWithGoogle({ next: "/practice/new" }).then(() => { settled = true; }, () => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(s.raw.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://app.test/auth/callback?next=%2Fpractice%2Fnew", queryParams: { prompt: "select_account" } } });
    expect(settled).toBe(false);
  });
});

describe("adapter: reads and RPCs", () => {
  it("dashboard stats: takes the first row and coerces numeric strings", async () => {
    const row = { sessions_used_today: 2, daily_limit: 5, next_reset_at: "2026-10-16T18:30:00Z", attempts_count: "3", average_score: "68.5", best_score: 74, total_practice_ms: 61000, total_key_points_covered: 20 };
    const d = mkData(fakeSupa({ rpc: { my_dashboard_stats: { data: [row] } } }));
    const s = await d.dashboard.getStats();
    expect(s.attempts_count).toBe(3); expect(s.average_score).toBe(68.5);
  });
  it("shape drift fails loudly in development", async () => {
    const d = mkData(fakeSupa({ rpc: { my_dashboard_stats: { data: [{ sessions_used_today: "many" }] } } }));
    await expect(d.dashboard.getStats()).rejects.toThrow(/my_dashboard_stats/);
  });
  it("RPC errors become AppErrors the UI map understands", async () => {
    const d = mkData(fakeSupa({ rpc: { start_practice_session: { data: null, error: { message: "daily_limit_reached" } } } }));
    await expect(d.sessions.start("d1", 5)).rejects.toBeInstanceOf(AppError);
    await expect(d.sessions.start("d1", 5)).rejects.toMatchObject({ code: "daily_limit_reached" });
  });
  it("deck detail composes the deck, slides and the latest session", async () => {
    const deck = { id: "d1", owner_id: "u1", title: "T", original_filename: "t.pdf", page_count: 2, status: "ready", processing_stage: null, processed_slides: 2, error_code: null, pinned_at: null, created_at: "x", updated_at: "x" };
    const slide = (i: number) => ({ id: `s${i}`, deck_id: "d1", slide_index: i, title: `S${i}`, extracted_text: null, key_points: ["a"], suggested_script: null, time_weight: 1, image_file_id: null, created_at: "x", updated_at: "x" });
    const s = fakeSupa({ tables: { decks: { data: deck }, slides: { data: [slide(0), slide(1)] }, practice_sessions: { data: [{ total_minutes: 5, suggested_seconds: [100, 200] }] } } });
    const r = await mkData(s).decks.get("d1");
    expect(r.slides).toHaveLength(2); expect(r.latest_total_minutes).toBe(5); expect(r.total_target_seconds).toBe(300);
    expect(s.calls).toContain('practice_sessions.neq("status","abandoned")');
  });
  it("profile update on a blocked student (no row matched) → blocked", async () => {
    const d = mkData(fakeSupa({ tables: { profiles: { data: [] } } }));
    await expect(d.profile.update({ college: "X", year: "1st year", branch: "CSE" })).rejects.toMatchObject({ code: "blocked" });
  });
  it("rate: omits an empty comment and trims", async () => {
    const s = fakeSupa({ rpc: { rate_report: { data: { id: "r", report_id: "rep", user_id: "u1", stars: 4, comment: "Nice", created_at: "x" } } } });
    await mkData(s).reports.rate("rep", 4, "  Nice ");
    await mkData(s).reports.rate("rep", 4, "   ");
    expect(s.calls.filter((c) => c.startsWith("rpc.rate_report"))).toEqual(['rpc.rate_report({"p_report_id":"rep","p_stars":4,"p_comment":"Nice"})', 'rpc.rate_report({"p_report_id":"rep","p_stars":4})']);
  });
  it("admin AI usage parses the jsonb shape (null slot/per_day lists become [])", async () => {
    const data = { purposes: [{ purpose: "slide_reading", slots: [{ slot_id: "a", slot: "primary", credit_limit: 1000, used: 4, remaining: 996, percent_used: 0.4, running_low: false, cooldown_until: null, last_error_code: null }], per_day: null }] };
    const r = await mkData(fakeSupa({ rpc: { admin_ai_usage: { data } } })).admin.aiUsage(7);
    expect(r.purposes[0]!.per_day).toEqual([]); expect(r.purposes[0]!.slots[0]!.used).toBe(4);
  });
  it("student list: passes search/limit/offset and total_count through", async () => {
    const s = fakeSupa({ rpc: { admin_list_students: { data: [{ user_id: "u2", full_name: null, email: "e", college: null, year: null, branch: null, avatar_url: null, attempts: 0, last_active_at: null, average_score: null, is_blocked: false, total_count: 412 }] } } });
    const r = await mkData(s).admin.listStudents({ search: " arjun ", limit: 25, offset: 50 });
    expect(r[0]!.total_count).toBe(412);
    expect(s.calls[0]).toBe('rpc.admin_list_students({"p_search":"arjun","p_limit":25,"p_offset":50})');
  });
});

describe("adapter: Edge Functions", () => {
  it("upload.init sends exactly the contract body and validates the response", async () => {
    const f = vi.fn(async () => jsonRes(200, { ok: true, data: { deck_id: "d1", upload: { url: "https://r2/x", method: "PUT", headers: { "Content-Type": "application/pdf", "Content-Length": "10" }, expires_at: "z" } } }));
    const d = mkData(fakeSupa({}), f as never);
    const r = await d.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" });
    expect(r.upload.headers["Content-Type"]).toBe("application/pdf");
    expect(JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string)).toEqual({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" });
  });
  it("too_many_pages keeps page_count / max_pages for the UI", async () => {
    const f = vi.fn(async () => jsonRes(400, { ok: false, error: { code: "too_many_pages", message: "m", page_count: 11, max_pages: 10 } }));
    const d = mkData(fakeSupa({}), f as never);
    await expect(d.upload.complete("d1")).rejects.toMatchObject({ code: "too_many_pages", details: { page_count: 11, max_pages: 10 } });
  });
  it("audio_invalid keeps slide_index + reason", async () => {
    const f = vi.fn(async () => jsonRes(400, { ok: false, error: { code: "audio_invalid", message: "m", slide_index: 2, reason: "not_16khz" } }));
    await expect(mkData(fakeSupa({}), f as never).sessions.analyse("s1")).rejects.toMatchObject({ code: "audio_invalid", details: { slide_index: 2, reason: "not_16khz" } });
  });
  it("account delete signs the local session out after the function succeeds", async () => {
    const s = fakeSupa({});
    const f = vi.fn(async () => jsonRes(200, { ok: true, data: { deleted: true, storage_cleanup: "complete" } }));
    const r = await mkData(s, f as never).account.delete("DELETE");
    expect(r).toMatchObject({ deleted: true, storage_cleanup: "complete" });
    expect(s.raw.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("admin keys come from admin-ai-keys", async () => {
    const f = vi.fn(async () => jsonRes(200, { ok: true, data: { purposes: [{ purpose: "slide_reading", model: "m", slots: [{ slot_id: "a", slot: "primary", configured: true, masked: "••••ab12" }] }] } }));
    const r = await mkData(fakeSupa({}), f as never).admin.aiKeys();
    expect(r.purposes[0]!.slots[0]!.masked).toBe("••••ab12");
  });
});

describe("adapter: realtime", () => {
  it("subscribes to UPDATE on the row id and delivers only the event columns", async () => {
    const s = fakeSupa({}); const d = mkData(s); const cb = vi.fn();
    const off = d.realtime.subscribeDeck("d1", cb);
    const ch = s.channels[0]!;
    expect(ch.on).toHaveBeenCalledWith("postgres_changes", { event: "UPDATE", schema: "public", table: "decks", filter: "id=eq.d1" }, expect.any(Function));
    ch.handler!({ new: { id: "d1", status: "processing", processing_stage: "Reading slide 2 of 3", processed_slides: 1, error_code: null, page_count: 3, owner_id: "u1", title: "secret" } });
    expect(cb).toHaveBeenCalledWith({ id: "d1", status: "processing", processing_stage: "Reading slide 2 of 3", processed_slides: 1, error_code: null, page_count: 3 });
    off();
    expect(s.raw.removeChannel).toHaveBeenCalledTimes(1);
  });
  it("session completion adds the report id", async () => {
    const s = fakeSupa({ tables: { reports: { data: { id: "rep1" } } } }); const d = mkData(s); const cb = vi.fn();
    d.realtime.subscribeSession("s1", cb);
    s.channels[0]!.handler!({ new: { id: "s1", status: "transcribing", analysis_stage: "Transcribed 1 of 2", error_code: null } });
    expect(cb).toHaveBeenLastCalledWith({ id: "s1", status: "transcribing", analysis_stage: "Transcribed 1 of 2", error_code: null });
    s.channels[0]!.handler!({ new: { id: "s1", status: "completed", analysis_stage: null, error_code: null } });
    await new Promise((r) => setTimeout(r, 5));
    expect(cb).toHaveBeenLastCalledWith({ id: "s1", status: "completed", analysis_stage: null, error_code: null, report_id: "rep1" });
  });
});
