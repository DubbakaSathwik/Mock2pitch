import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, expectCode, makeReadyDeck, readyStudent, type Db } from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

const fileSql = "insert into public.files(owner_id,deck_id,session_id,kind,slide_index,bucket,object_key,mime_type,expected_size_bytes,status) values ($1,$2,$3,$4,$5,'b',$6,'x',1,$7)";
const key = () => `k-${Math.random()}`;

describe("files constraints", () => {
  it("enforces kind/owner-reference consistency and slide_index", async () => {
    const u = await readyStudent(db, "f1@example.test");
    const deck = await makeReadyDeck(db, u);
    const s = (await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{1}','in_progress') returning id", [deck, u])).rows[0].id;
    await expect(db.admin.query(fileSql, [u, deck, null, "audio_clip", 0, key(), "pending"])).rejects.toThrow(/files_owner_ref/);
    await expect(db.admin.query(fileSql, [u, null, s, "slide_image", 0, key(), "pending"])).rejects.toThrow(/files_owner_ref/);
    await expect(db.admin.query(fileSql, [u, deck, s, "deck_pdf", null, key(), "pending"])).rejects.toThrow(/files_owner_ref/);
    await expect(db.admin.query(fileSql, [u, deck, null, "deck_pdf", 0, key(), "pending"])).rejects.toThrow(/files_slide_index_req/);
    await expect(db.admin.query(fileSql, [u, deck, null, "slide_image", null, key(), "pending"])).rejects.toThrow(/files_slide_index_req/);
    await expect(db.admin.query(fileSql, [u, deck, null, "slide_image", 10, key(), "pending"])).rejects.toThrow(/check constraint/);
    await db.admin.query(fileSql, [u, deck, null, "deck_pdf", null, key(), "pending"]);
  });
  it("allows one live file per slot, and a re-upload once the old one is deleted/failed", async () => {
    const u = await readyStudent(db, "f2@example.test");
    const deck = await makeReadyDeck(db, u);
    await db.admin.query(fileSql, [u, deck, null, "slide_image", 0, key(), "uploaded"]);
    await expect(db.admin.query(fileSql, [u, deck, null, "slide_image", 0, key(), "pending"])).rejects.toThrow(/files_one_live_image/);
    await db.admin.query("update public.files set status='failed' where deck_id=$1", [deck]);
    await db.admin.query(fileSql, [u, deck, null, "slide_image", 0, key(), "pending"]);
    const k = key();
    await db.admin.query(fileSql, [u, deck, null, "slide_image", 1, k, "pending"]);
    await expect(db.admin.query(fileSql, [u, deck, null, "slide_image", 2, k, "pending"])).rejects.toThrow(/duplicate key/); // object_key unique
  });
  it("one live audio clip per (session, slide)", async () => {
    const u = await readyStudent(db, "f3@example.test");
    const deck = await makeReadyDeck(db, u);
    const s = (await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{1}','in_progress') returning id", [deck, u])).rows[0].id;
    await db.admin.query(fileSql, [u, null, s, "audio_clip", 0, key(), "pending"]);
    await expect(db.admin.query(fileSql, [u, null, s, "audio_clip", 0, key(), "pending"])).rejects.toThrow(/files_one_live_clip/);
  });
});

describe("state uniqueness", () => {
  it("one in-flight deck per user", async () => {
    const u = await readyStudent(db, "d1@example.test");
    const ins = (status: string) => db.admin.query("insert into public.decks(owner_id,title,original_filename,status) values ($1,'t','t.pdf',$2)", [u, status]);
    await ins("awaiting_upload");
    for (const st of ["awaiting_upload", "uploaded", "awaiting_images", "processing"]) await expect(ins(st)).rejects.toThrow(/decks_one_active_per_owner/);
    await ins("ready"); await ins("failed"); // terminal states are unrestricted
    await db.admin.query("update public.decks set status='failed' where status='awaiting_upload'");
    await ins("processing");
  });
  it("one analysing session per user; attempt numbers unique among non-abandoned", async () => {
    const u = await readyStudent(db, "d2@example.test");
    const deck = await makeReadyDeck(db, u);
    const ins = (att: number, status: string) => db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,$3,5,'{1}',$4)", [deck, u, att, status]);
    await ins(1, "transcribing");
    for (const st of ["uploading_audio", "transcribing", "generating_report"]) await expect(ins(2, st)).rejects.toThrow(/sessions_one_analysing_per_owner/);
    await ins(2, "failed"); // failed does not hold the slot
    await expect(ins(2, "in_progress")).rejects.toThrow(/sessions_deck_attempt_uniq/);
    await ins(2, "abandoned");
    await expect(ins(1, "completed")).rejects.toThrow(/sessions_deck_attempt_uniq/);
  });
  it("one rating per report; rating stars/comment constrained at the table level", async () => {
    const u = await readyStudent(db, "d3@example.test");
    const deck = await makeReadyDeck(db, u);
    const s = (await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{1}','completed') returning id", [deck, u])).rows[0].id;
    const r = (await db.admin.query("insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) values ($1,$2,$3,1,50,50,50,50,50,'h','{a,b,c}','{a,b,c}','v1') returning id", [s, u, deck])).rows[0].id;
    await db.admin.query("insert into public.report_ratings(report_id,user_id,stars) values ($1,$2,3)", [r, u]);
    await expect(db.admin.query("insert into public.report_ratings(report_id,user_id,stars) values ($1,$2,4)", [r, u])).rejects.toThrow(/duplicate key/);
    await expect(db.admin.query("update public.report_ratings set stars=9")).rejects.toThrow(/check constraint/);
    await expect(db.admin.query("insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) values ($1,$2,$3,1,101,50,50,50,50,'h','{a,b,c}','{a,b,c}','v1')", [s, u, deck])).rejects.toThrow(/check constraint|duplicate key/);
    await expect(db.admin.query("insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) select gen_random_uuid(),$1,$2,1,50,50,50,50,50,'h','{a,b}','{a,b,c}','v1'", [u, deck])).rejects.toThrow(/violates/);
  });
  it("slides/decks range constraints", async () => {
    const u = await readyStudent(db, "d4@example.test");
    await expect(db.admin.query("insert into public.decks(owner_id,title,original_filename,page_count,status) values ($1,'t','t.pdf',11,'ready')", [u])).rejects.toThrow(/check constraint/);
    const deck = await makeReadyDeck(db, u, [5]);
    await expect(db.admin.query("insert into public.slides(deck_id,slide_index,time_weight) values ($1,1,0)", [deck])).rejects.toThrow(/check constraint/);
    await expect(db.admin.query("insert into public.slides(deck_id,slide_index,time_weight) values ($1,0,5)", [deck])).rejects.toThrow(/duplicate key/);
    await expect(db.admin.query("insert into public.slides(deck_id,slide_index,time_weight,key_points) values ($1,2,5,'{a,b,c,d,e,f}')", [deck])).rejects.toThrow(/check constraint/);
  });
});

describe("cascades", () => {
  it("deleting an auth user removes all their rows but keeps anonymised AI usage", async () => {
    const u = await readyStudent(db, "cascade@example.test");
    const deck = await makeReadyDeck(db, u);
    const s = (await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{1}','completed') returning id", [deck, u])).rows[0].id;
    const r = (await db.admin.query("insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) values ($1,$2,$3,1,50,50,50,50,50,'h','{a,b,c}','{a,b,c}','v1') returning id", [s, u, deck])).rows[0].id;
    await db.admin.query("insert into public.report_ratings(report_id,user_id,stars) values ($1,$2,3)", [r, u]);
    await db.admin.query("insert into public.session_slide_results(session_id,slide_index) values ($1,0)", [s]);
    await db.admin.query(fileSql, [u, deck, null, "slide_image", 0, key(), "uploaded"]);
    await db.admin.query("insert into public.usage_events(user_id,kind,local_date) values ($1,'upload',current_date)", [u]);
    await db.admin.query("insert into public.ai_usage_log(purpose,outcome,user_id,deck_id) values ('slide_reading','success',$1,$2)", [u, deck]);
    await db.admin.query("insert into public.policy_acceptances(user_id,policy_version_id) select $1,id from public.policy_versions on conflict do nothing", [u]);
    await db.admin.query("delete from auth.users where id=$1", [u]).catch(() => {});
    // auth.users has no FK to profiles in the stub; delete the profile as Supabase's FK cascade would
    await db.admin.query("delete from public.profiles where id=$1", [u]);
    for (const t of ["decks", "practice_sessions", "reports", "report_ratings", "files", "usage_events", "policy_acceptances", "slides", "session_slide_results"]) {
      const n = (await db.admin.query(`select count(*)::int n from public.${t} where ${t === "slides" ? "deck_id" : t === "session_slide_results" ? "session_id" : t === "reports" ? "owner_id" : t === "report_ratings" ? "user_id" : t === "usage_events" || t === "policy_acceptances" ? "user_id" : "owner_id"} in ($1,$2,$3)`, [u, deck, s])).rows[0].n;
      expect(n, t).toBe(0);
    }
    const log = (await db.admin.query("select user_id, deck_id from public.ai_usage_log where purpose='slide_reading' and outcome='success' and deck_id=$1", [deck])).rows;
    expect(log).toEqual([{ user_id: null, deck_id: deck }]);
  });
});

describe("service functions", () => {
  const images = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ slide_index: i, bucket: "b", object_key: `img-${Math.random()}-${i}`, expected_size_bytes: 1000 })));
  async function pendingDeck(email: string) {
    const u = await readyStudent(db, email);
    const deck = (await db.admin.query("insert into public.decks(owner_id,title,original_filename,status) values ($1,'t','t.pdf','awaiting_upload') returning id", [u])).rows[0].id;
    await db.admin.query(fileSql, [u, deck, null, "deck_pdf", null, key(), "pending"]);
    return { u, deck };
  }
  it("svc_complete_deck_upload consumes a session, flips state and creates N pending image rows atomically", async () => {
    const { u, deck } = await pendingDeck("svc1@example.test");
    await db.admin.query("select public.svc_complete_deck_upload($1,3,12345,$2)", [deck, images(3)]);
    expect((await db.admin.query("select status,page_count from public.decks where id=$1", [deck])).rows[0]).toEqual({ status: "awaiting_images", page_count: 3 });
    expect((await db.admin.query("select status,size_bytes::int s from public.files where kind='deck_pdf' and deck_id=$1", [deck])).rows[0]).toEqual({ status: "uploaded", s: 12345 });
    expect((await db.admin.query("select count(*)::int n from public.files where kind='slide_image' and deck_id=$1 and status='pending'", [deck])).rows[0].n).toBe(3);
    expect((await db.admin.query("select private.sessions_used_today($1) n", [u])).rows[0].n).toBe(1);
    await expect(db.admin.query("select public.svc_complete_deck_upload($1,3,1,$2)", [deck, images(3)])).rejects.toThrow("invalid_state");
  });
  it("at the daily limit it raises and charges/changes nothing", async () => {
    const { u, deck } = await pendingDeck("svc2@example.test");
    for (let i = 0; i < 5; i++) await db.admin.query("select private.consume_daily_session($1,'upload',null,null)", [u]);
    await expect(db.admin.query("select public.svc_complete_deck_upload($1,3,1,$2)", [deck, images(3)])).rejects.toThrow("daily_limit_reached");
    expect((await db.admin.query("select status from public.decks where id=$1", [deck])).rows[0].status).toBe("awaiting_upload");
    expect((await db.admin.query("select count(*)::int n from public.files where deck_id=$1 and kind='slide_image'", [deck])).rows[0].n).toBe(0);
  });
  it("blocked users cannot complete an upload", async () => {
    const { u, deck } = await pendingDeck("svc3@example.test");
    await db.admin.query("update public.profiles set is_blocked=true where id=$1", [u]);
    await expect(db.admin.query("select public.svc_complete_deck_upload($1,3,1,$2)", [deck, images(3)])).rejects.toThrow("blocked");
  });
  it("svc_finalize_report writes results + report, completes the session, and is idempotent", async () => {
    const u = await readyStudent(db, "svc4@example.test");
    const deck = await makeReadyDeck(db, u, [10, 10]);
    const s = (await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{150,150}','generating_report') returning id", [deck, u])).rows[0].id;
    const report = { overall_score: 77, coverage_score: 80, clarity_score: 70, timing_score: 90, filler_score: 60, overall_wpm: 140.5, total_duration_ms: 290000, key_points_covered: 5, key_points_total: 6, filler_total: 4, headline: "Good", top_fixes: ["a", "b", "c"], did_well: ["x", "y", "z"], delta_from_first: null, first_attempt_score: null, scoring_version: "v1", models: { report: "m" } };
    const results = [{ slide_index: 0, duration_ms: 100000, suggested_seconds: 150, word_count: 200, wpm: 120, transcript: "hello um", word_timings: [{ w: "hello", start_ms: 0, end_ms: 100 }], filler_count: 1, fillers: [{ word: "um", count: 1 }], key_points_covered: [0, 1], key_points_missed: [2], off_topic_quotes: [], slide_feedback: "ok" }];
    const id = (await db.admin.query("select public.svc_finalize_report($1,$2,$3) id", [s, JSON.stringify(report), JSON.stringify(results)])).rows[0].id;
    expect(id).toBeTruthy();
    expect((await db.admin.query("select status, completed_at is not null c from public.practice_sessions where id=$1", [s])).rows[0]).toEqual({ status: "completed", c: true });
    const row = (await db.admin.query("select overall_score, top_fixes, overall_wpm::float w from public.reports where session_id=$1", [s])).rows[0];
    expect(row).toEqual({ overall_score: 77, top_fixes: ["a", "b", "c"], w: 140.5 });
    expect((await db.admin.query("select key_points_covered k, fillers from public.session_slide_results where session_id=$1", [s])).rows[0]).toEqual({ k: [0, 1], fillers: [{ word: "um", count: 1 }] });
    await expect(db.admin.query("select public.svc_finalize_report($1,$2,$3)", [s, JSON.stringify(report), JSON.stringify(results)])).rejects.toThrow("invalid_state");
  });
  it("svc_ai_slot_states reports cooldown, credits used and last-minute requests", async () => {
    const slot = (await db.admin.query("select id from public.ai_key_slots where purpose='speech_to_text' and slot='primary'")).rows[0].id;
    await db.admin.query("update public.ai_key_slots set credit_period_start = now() - interval '1 day' where id=$1", [slot]);
    await db.admin.query(`insert into public.ai_usage_log(purpose,key_slot_id,outcome,created_at) values ('speech_to_text',$1,'success',now()),('speech_to_text',$1,'rate_limited',now()),('speech_to_text',$1,'success', now() - interval '5 minutes')`, [slot]);
    const r = (await db.admin.query("select * from public.svc_ai_slot_states('speech_to_text') where slot='primary'")).rows[0];
    expect(r).toMatchObject({ used_credits: 2, requests_last_60s: 2, credit_limit: 1000, cooldown_until: null });
  });
});
