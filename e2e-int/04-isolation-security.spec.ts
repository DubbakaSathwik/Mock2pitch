// Security review on the real stack: student B attacks student NEW's rows (decks, slides, sessions, reports, files, ratings, profile) through
// supabase-js, the Edge Functions and Realtime. Everything must be denied or invisible. Needs it-ids.json from 02-onboarding-practice.
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { userApi } from "./support/api";
import { passwordSession } from "./support/session";

const ids = JSON.parse(fs.readFileSync(".integration-state.json", "utf8")) as { deckId: string; sessionId: string; reportId: string; userNew: string };
let b: Awaited<ReturnType<typeof userApi>>;
test.beforeAll(async () => { b = await userApi("B"); });

test("B cannot read any of NEW's rows (tables)", async () => {
  // (files: the key columns are not granted, so `select *` is denied by design: select the safe columns)
  const empty = async (t: string, col: string, v: string) => { const r = await b.client.from(t as never).select(t === "files" ? "id,kind,status" : "*").eq(col, v); expect(r.error, `${t}: ${r.error?.message}`).toBeNull(); expect(r.data, t).toEqual([]); };
  await empty("decks", "id", ids.deckId);
  await empty("slides", "deck_id", ids.deckId);
  await empty("practice_sessions", "id", ids.sessionId);
  await empty("reports", "id", ids.reportId);
  await empty("session_slide_results", "session_id", ids.sessionId);
  await empty("files", "deck_id", ids.deckId);
  await empty("report_ratings", "report_id", ids.reportId);
  await empty("policy_acceptances", "user_id", ids.userNew);
  await empty("usage_events", "user_id", ids.userNew);
  await empty("profiles", "id", ids.userNew);
  // unfiltered selects only ever return B's own rows
  for (const t of ["decks", "reports", "practice_sessions", "usage_events", "report_ratings", "policy_acceptances"]) {
    const r = await b.client.from(t as never).select("*");
    for (const row of (r.data ?? []) as Record<string, unknown>[]) expect([row.owner_id, row.user_id].filter(Boolean)).toContain(b.userId);
  }
  const prof = await b.client.from("profiles").select("id");
  expect(prof.data).toEqual([{ id: b.userId }]);
});

test("the files table exposes no storage keys; audio clips are never visible", async () => {
  const r = await b.client.from("files").select("object_key");
  expect(r.error?.code).toBe("42501"); // column-level grant excludes bucket/object_key
  const mine = await b.client.from("files").select("kind");
  expect((mine.data ?? []).every((f: { kind: string }) => f.kind !== "audio_clip")).toBe(true);
});

test("B cannot write NEW's rows or escalate privileges", async () => {
  const upd = async (t: string, patch: object, col: string, v: string) => { const r = await b.client.from(t as never).update(patch as never).eq(col, v).select(); expect((r.data ?? []).length, `${t} update`).toBe(0); };
  await upd("profiles", { college: "hacked" }, "id", ids.userNew);
  await upd("decks", { title: "hacked" }, "id", ids.deckId);
  await upd("reports", { overall_score: 100 }, "id", ids.reportId);
  const del = await b.client.from("decks").delete().eq("id", ids.deckId).select();
  expect((del.data ?? []).length).toBe(0);
  // own-row privilege escalation: role / is_blocked / email are not updatable columns
  for (const patch of [{ role: "admin" }, { is_blocked: false }, { email: "x@y.z" }]) {
    const r = await b.client.from("profiles").update(patch as never).eq("id", b.userId).select();
    expect(r.error?.code === "42501" || (r.data ?? []).length === 0, JSON.stringify(patch)).toBe(true);
  }
  const { data: me } = await b.client.from("profiles").select("role").eq("id", b.userId).single();
  expect(me!.role).toBe("student");
  // inserts into server-owned tables are not allowed
  for (const t of ["reports", "decks", "practice_sessions", "usage_events", "slides", "report_ratings", "files", "session_slide_results"]) {
    const r = await b.client.from(t as never).insert({ id: crypto.randomUUID() } as never);
    expect(r.error, `${t} insert`).not.toBeNull();
  }
});

test("server-only tables and admin RPCs are denied to students", async () => {
  for (const t of ["ai_key_slots", "ai_usage_log", "admin_actions"]) { const r = await b.client.from(t as never).select("*"); expect(r.error?.code, t).toBe("42501"); }
  for (const [name, args] of [["admin_overview", {}], ["admin_list_students", {}], ["admin_student_detail", { p_user_id: ids.userNew }], ["admin_set_blocked", { p_user_id: ids.userNew, p_blocked: true }], ["admin_ratings", {}], ["admin_ai_usage", {}], ["admin_policy_versions", {}], ["admin_publish_policy", { p_version_label: "v9.9", p_terms_body: "x", p_privacy_body: "y" }], ["admin_set_credit_limit", { p_slot_id: crypto.randomUUID(), p_limit: 1 }]] as [string, object][]) {
    const r = await b.client.rpc(name as never, args as never);
    expect(r.error?.message, name).toBe("forbidden");
  }
  for (const [name, args] of [["svc_begin_account_deletion", { p_uid: ids.userNew }], ["svc_pending_deletions", {}], ["svc_finalize_report", { p_session_id: ids.sessionId, p_report: {}, p_results: [] }]] as [string, object][]) {
    const r = await b.client.rpc(name as never, args as never);
    expect(r.error?.code, name).toBe("42501"); // service_role only
  }
  const ver = await b.client.rpc("hook_before_user_created" as never, { event: {} } as never);
  expect(ver.error?.code).toBe("42501");
});

test("student RPCs and functions on NEW's objects look like 'does not exist'", async () => {
  expect((await b.client.rpc("set_deck_pinned", { p_deck_id: ids.deckId, p_pinned: true })).error?.message).toBe("not_found");
  expect((await b.client.rpc("rate_report", { p_report_id: ids.reportId, p_stars: 1 })).error?.message).toBe("not_found");
  expect((await b.client.rpc("start_practice_session", { p_deck_id: ids.deckId, p_total_minutes: 5 })).error?.message).toBe("not_found");
  expect((await b.client.rpc("my_deck_detail", { p_deck_id: ids.deckId })).data).toEqual([]);
  for (const [fn, body] of [["asset-urls", { deck_id: ids.deckId, kinds: ["slide_image"] }], ["session-submit-init", { session_id: ids.sessionId, clips: [{ slide_index: 0, size_bytes: 1000 }] }], ["session-analyse", { session_id: ids.sessionId }], ["deck-process", { deck_id: ids.deckId }], ["deck-upload-complete", { deck_id: ids.deckId }]] as [string, object][]) {
    const r = await b.fn(fn, body as Record<string, unknown>);
    expect(r.status, fn).toBeGreaterThanOrEqual(400);
    expect(r.error?.code, fn).toMatch(/not_found|forbidden/);
  }
  expect((await b.fn("admin-ai-keys", {})).error?.code).toBe("forbidden");
});

test("Realtime: B never receives NEW's row changes; NEW does (payload carries the event columns)", async () => {
  const nw = await passwordSession("NEW");
  const bs = await passwordSession("B");
  nw.client.realtime.setAuth(nw.session.access_token);
  bs.client.realtime.setAuth(bs.session.access_token);
  const mine: any[] = [], theirs: any[] = [];
  const subscribe = (c: typeof nw.client, sink: any[], name: string) => new Promise<void>((res, rej) => {
    c.channel(name).on("postgres_changes", { event: "UPDATE", schema: "public", table: "decks", filter: `id=eq.${ids.deckId}` }, (p) => sink.push(p.new)).subscribe((s, e) => { if (s === "SUBSCRIBED") res(); if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") rej(e ?? new Error(s)); });
  });
  await Promise.all([subscribe(nw.client, mine, "own"), subscribe(bs.client, theirs, "attacker")]);
  await new Promise((r) => setTimeout(r, 1500));
  const { data: before } = await nw.client.from("decks").select("pinned_at").eq("id", ids.deckId).single();
  const toggle = await nw.client.rpc("set_deck_pinned", { p_deck_id: ids.deckId, p_pinned: before!.pinned_at === null });
  expect(toggle.error).toBeNull();
  await expect.poll(() => mine.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await new Promise((r) => setTimeout(r, 3000));
  expect(theirs).toEqual([]);
  expect(mine[0]).toMatchObject({ id: ids.deckId, status: "ready" });
  for (const k of ["processing_stage", "processed_slides", "error_code", "page_count"]) expect(Object.keys(mine[0])).toContain(k);
  await nw.client.rpc("set_deck_pinned", { p_deck_id: ids.deckId, p_pinned: before!.pinned_at !== null }); // restore
  await Promise.all([nw.client.removeAllChannels(), bs.client.removeAllChannels()]);
});
