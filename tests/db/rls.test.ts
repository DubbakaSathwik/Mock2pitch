// Allowed/denied matrix for anon, student A/B, blocked student C and the admin (real roles + JWT claims).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, expectCode, expectDenied, makeReadyDeck, readyStudent, type Db } from "./harness";

let db: Db;
let A: string, B: string, C: string, ADMIN: string;
let deckA: string, deckB: string, sessA: string, reportA: string, reportB: string;

beforeAll(async () => {
  db = await createDb();
  A = await readyStudent(db, "student.a@mock2pitch.test");
  B = await readyStudent(db, "student.b@mock2pitch.test");
  C = await readyStudent(db, "student.blocked@mock2pitch.test");
  ADMIN = await db.makeUser("owner@mock2pitch.test");
  deckA = await makeReadyDeck(db, A, [10, 20], "A deck");
  deckB = await makeReadyDeck(db, B, [10, 20], "B deck");
  const sA = await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{100,200}','completed') returning id", [deckA, A]);
  sessA = sA.rows[0].id;
  const sB = await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status,submitted_at) values ($1,$2,1,5,'{100,200}','completed', now()) returning id", [deckB, B]);
  const rep = (sess: string, owner: string, deck: string, score: number) => db.admin.query(
    `insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version,total_duration_ms,key_points_covered,key_points_total)
     values ($1,$2,$3,1,$4,70,70,70,70,'secret headline','{x,y,z}','{x,y,z}','v1',60000,4,6) returning id`, [sess, owner, deck, score]);
  reportA = (await rep(sessA, A, deckA, 62)).rows[0].id;
  reportB = (await rep(sB.rows[0].id, B, deckB, 74)).rows[0].id;
  await db.admin.query("insert into public.session_slide_results(session_id,slide_index,transcript) values ($1,0,'private words')", [sessA]);
  await db.admin.query("insert into public.files(owner_id,deck_id,kind,slide_index,bucket,object_key,mime_type,expected_size_bytes,status) values ($1,$2,'slide_image',0,'b','users/a/img.jpg','image/jpeg',10,'uploaded')", [A, deckA]);
  await db.admin.query("insert into public.files(owner_id,session_id,kind,slide_index,bucket,object_key,mime_type,expected_size_bytes,status) values ($1,$2,'audio_clip',0,'b','users/a/clip.wav','audio/wav',10,'uploaded')", [A, sessA]);
  await db.admin.query("insert into public.usage_events(user_id,kind,local_date) values ($1,'upload',public.ist_date(now()))", [A]);
  await db.admin.query("update public.profiles set is_blocked=true, blocked_at=now() where id=$1", [C]);
  await db.admin.query("insert into public.report_ratings(report_id,user_id,stars,comment) values ($1,$2,5,'great')", [reportB, B]);
});
afterAll(async () => { await db.close(); });

const count = async (uid: string | null, table: string, role?: "anon") => (await db.q(uid, `select count(*)::int n from public.${table}`, [], role))[0].n as number;

describe("anon", () => {
  it("reads policy_versions only", async () => {
    expect(await count(null, "policy_versions", "anon")).toBeGreaterThan(0);
    for (const t of ["profiles", "decks", "slides", "files", "practice_sessions", "usage_events", "session_slide_results", "reports", "report_ratings", "ai_key_slots", "ai_usage_log", "policy_acceptances"]) {
      await expectDenied(db.q(null, `select * from public.${t}`, [], "anon"));
    }
  });
  it("cannot call practice or admin RPCs", async () => {
    for (const fn of ["public.start_practice_session(gen_random_uuid(),5)", "public.accept_policy(gen_random_uuid())", "public.rate_report(gen_random_uuid(),5,null)",
      "public.set_deck_pinned(gen_random_uuid(),true)", "public.my_decks()", "public.admin_overview()", "public.svc_finalize_report(gen_random_uuid(),'{}','[]')"]) {
      await expectDenied(db.q(null, `select * from ${fn}`, [], "anon"));
    }
  });
});

describe("student A (own data only)", () => {
  it("sees exactly own rows in every content table", async () => {
    expect(await count(A, "profiles")).toBe(1);
    expect(await count(A, "decks")).toBe(1);
    expect(await count(A, "slides")).toBe(2);
    expect(await count(A, "practice_sessions")).toBe(1);
    expect(await count(A, "reports")).toBe(1);
    expect(await count(A, "session_slide_results")).toBe(1);
    expect(await count(A, "usage_events")).toBe(1);
    expect(await count(A, "report_ratings")).toBe(0);
  });
  it("cannot see B's rows even by id", async () => {
    expect(await db.q(A, "select id from public.decks where id=$1", [deckB])).toEqual([]);
    expect(await db.q(A, "select id from public.slides where deck_id=$1", [deckB])).toEqual([]);
    expect(await db.q(A, "select id from public.reports where id=$1", [reportB])).toEqual([]);
    expect(await db.q(A, "select id from public.report_ratings where report_id=$1", [reportB])).toEqual([]);
    expect(await db.q(A, "select id from public.profiles where id=$1", [B])).toEqual([]);
  });
  it("cannot write content tables directly", async () => {
    for (const sql of [
      "insert into public.decks(owner_id,title,original_filename,status) values ($1,'x','x.pdf','ready')",
      "update public.decks set title='hax' where owner_id=$1",
      "delete from public.decks where owner_id=$1",
      "insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) values (gen_random_uuid(),$1,gen_random_uuid(),1,100,1,1,1,1,'h','{a,b,c}','{a,b,c}','v1')",
      "update public.reports set overall_score=100 where owner_id=$1",
      "insert into public.usage_events(user_id,kind,local_date) values ($1,'upload',current_date)",
      "delete from public.usage_events where user_id=$1",
      "update public.practice_sessions set status='completed' where owner_id=$1",
      "insert into public.slides(deck_id,slide_index,time_weight) values (gen_random_uuid(),1,5)",
      "insert into public.policy_acceptances(user_id,policy_version_id) select $1,id from public.policy_versions",
      "insert into public.policy_versions(version_label,terms_body,privacy_body) values ('v99','a','b')",
      "insert into public.files(owner_id,deck_id,kind,slide_index,bucket,object_key,mime_type,expected_size_bytes,status) values ($1,gen_random_uuid(),'slide_image',0,'b','k','image/jpeg',1,'pending')",
      "insert into public.report_ratings(report_id,user_id,stars) values (gen_random_uuid(),$1,5)",
    ]) await expectDenied(db.q(A, sql, sql.includes("$1") ? [A] : []));
  });
  it("sees file metadata but never object keys, and never audio clip rows", async () => {
    const rows = await db.q(A, "select id, kind from public.files");
    expect(rows.map((r) => r.kind)).toEqual(["slide_image"]);
    await expectDenied(db.q(A, "select object_key from public.files"));
    await expectDenied(db.q(A, "select bucket from public.files"));
    await expectDenied(db.q(A, "select * from public.files"));
  });
  it("cannot read AI tables or the admin audit log", async () => {
    for (const t of ["ai_key_slots", "ai_usage_log", "admin_actions"]) await expectDenied(db.q(A, `select * from public.${t}`));
    await expectDenied(db.q(A, "select * from private.pending_deletions"), "permission denied for schema private");
    await expectDenied(db.q(A, "select private.consume_daily_session(gen_random_uuid(),'upload',null,null)"), "permission denied for schema private");
  });
  it("cannot call service-only functions", async () => {
    await expectDenied(db.q(A, "select public.svc_touch_active($1)", [B]));
    await expectDenied(db.q(A, "select * from public.svc_ai_slot_states('slide_reading')"));
    await expectDenied(db.q(A, "select public.svc_complete_deck_upload(gen_random_uuid(),3,10,'[]')"));
  });
  it("can pin own deck but not B's", async () => {
    await db.q(A, "select public.set_deck_pinned($1,true)", [deckA]);
    expect((await db.admin.query("select pinned_at from public.decks where id=$1", [deckA])).rows[0].pinned_at).not.toBeNull();
    await expectCode(db.q(A, "select public.set_deck_pinned($1,true)", [deckB]), "not_found");
    await db.q(A, "select public.set_deck_pinned($1,false)", [deckA]);
  });
  it("can rate own report once; cannot rate B's; stars/comment validated", async () => {
    await expectCode(db.q(A, "select * from public.rate_report($1,5,'x')", [reportB]), "not_found");
    await expectCode(db.q(A, "select * from public.rate_report($1,6,'x')", [reportA]), "invalid_stars");
    await expectCode(db.q(A, "select * from public.rate_report($1,0,'x')", [reportA]), "invalid_stars");
    await expectCode(db.q(A, "select * from public.rate_report($1,4,$2)", [reportA, "x".repeat(501)]), "comment_too_long");
    const r = await db.q(A, "select * from public.rate_report($1,4,'  nice  ')", [reportA]);
    expect(r[0]).toMatchObject({ stars: 4, comment: "nice" });
    await expectCode(db.q(A, "select * from public.rate_report($1,5,null)", [reportA]), "already_rated");
    expect(await count(A, "report_ratings")).toBe(1);
  });
  it("dashboard / decks / detail views only reflect own data", async () => {
    const st = (await db.q(A, "select * from public.my_dashboard_stats()"))[0];
    expect(st).toMatchObject({ sessions_used_today: 1, daily_limit: 5, attempts_count: 1, best_score: 62, total_practice_ms: "60000", total_key_points_covered: "4" });
    const decks = await db.q(A, "select * from public.my_decks()");
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ title: "A deck", attempts_count: 1, latest_score: 62 });
    expect(await db.q(A, "select * from public.my_deck_detail($1)", [deckB])).toEqual([]);
    expect(await db.q(A, "select * from public.my_deck_detail($1)", [deckA])).toHaveLength(1);
  });
  it("my_decks orders pinned first", async () => {
    const d2 = await makeReadyDeck(db, A, [10], "Newer deck");
    await db.q(A, "select public.set_deck_pinned($1,true)", [deckA]);
    expect((await db.q(A, "select title from public.my_decks()")).map((r) => r.title)).toEqual(["A deck", "Newer deck"]);
    await db.q(A, "select public.set_deck_pinned($1,false)", [deckA]);
    await db.admin.query("delete from public.decks where id=$1", [d2]);
  });
  it("cannot call admin RPCs", async () => {
    for (const fn of ["admin_overview()", "admin_sessions_per_day(7)", "admin_list_students(null,10,0)", "admin_ratings(null)", "admin_ai_usage(7)", "admin_policy_versions()"]) {
      await expectCode(db.q(A, `select * from public.${fn}`), "forbidden");
    }
    await expectCode(db.q(A, "select public.admin_student_detail($1)", [B]), "forbidden");
    await expectCode(db.q(A, "select public.admin_set_blocked($1,true)", [B]), "forbidden");
    await expectCode(db.q(A, "select public.admin_set_credit_limit(gen_random_uuid(),5,false)"), "forbidden");
  });
});

describe("blocked student C", () => {
  it("can read own data, cannot act", async () => {
    expect(await count(C, "profiles")).toBe(1);
    const deckC = await makeReadyDeck(db, C);
    expect(await count(C, "decks")).toBe(1);
    await expectCode(db.q(C, "select * from public.start_practice_session($1,5)", [deckC]), "blocked");
    await expectCode(db.q(C, "select public.set_deck_pinned($1,true)", [deckC]), "blocked");
    await expectCode(db.q(C, "select public.check_can_practise()"), "blocked");
    await expectCode(db.q(C, "select public.check_can_practise(false,false)"), "blocked"); // submit path
    const sC = await db.admin.query("insert into public.practice_sessions(deck_id,owner_id,attempt_number,total_minutes,suggested_seconds,status) values ($1,$2,1,5,'{1}','completed') returning id", [deckC, C]);
    const rC = await db.admin.query("insert into public.reports(session_id,owner_id,deck_id,attempt_number,overall_score,coverage_score,clarity_score,timing_score,filler_score,headline,top_fixes,did_well,scoring_version) values ($1,$2,$3,1,50,50,50,50,50,'h','{a,b,c}','{a,b,c}','v1') returning id", [sC.rows[0].id, C, deckC]);
    await expectCode(db.q(C, "select * from public.rate_report($1,3,null)", [rC.rows[0].id]), "blocked");
  });
  it("can still accept a policy version", async () => {
    const v = (await db.admin.query("select id from public.policy_versions order by published_at desc limit 1")).rows[0].id;
    await db.q(C, "select public.accept_policy($1)", [v]);
  });
});

describe("admin", () => {
  it("cannot directly select any student content table", async () => {
    for (const t of ["decks", "slides", "files", "practice_sessions", "usage_events", "session_slide_results", "reports", "report_ratings", "policy_acceptances"]) {
      expect(await count(ADMIN, t)).toBe(0);
    }
    expect(await count(ADMIN, "profiles")).toBe(1); // own row only
  });
  it("cannot practise (D4)", async () => {
    await expectCode(db.q(ADMIN, "select * from public.start_practice_session($1,5)", [deckA]), "is_admin");
    await expectCode(db.q(ADMIN, "select public.check_can_practise()"), "is_admin");
    await expectCode(db.q(ADMIN, "select public.check_can_practise(false,false)"), "is_admin");
    await expectCode(db.q(ADMIN, "select * from public.rate_report($1,5,null)", [reportA]), "is_admin");
    await expectCode(db.q(ADMIN, "select public.set_deck_pinned($1,true)", [deckA]), "is_admin");
  });
  it("overview / students / detail / ratings expose summary fields only", async () => {
    const ov = (await db.q(ADMIN, "select * from public.admin_overview()"))[0];
    expect(ov).toMatchObject({ total_students: 3, sessions_all_time: 1, ratings_count: 2 });
    const list = await db.q(ADMIN, "select * from public.admin_list_students(null,50,0)");
    expect(list).toHaveLength(3);
    expect(Object.keys(list[0]).sort()).toEqual(["attempts", "avatar_url", "average_score", "branch", "college", "email", "full_name", "is_blocked", "last_active_at", "total_count", "user_id", "year"]);
    const detail = (await db.q(ADMIN, "select public.admin_student_detail($1) d", [B]))[0].d;
    expect(Object.keys(detail).sort()).toEqual(["attempts", "profile", "ratings"]);
    expect(detail.attempts[0]).toMatchObject({ deck_title: "B deck", attempt_number: 1, overall_score: 74 });
    expect(Object.keys(detail.attempts[0]).sort()).toEqual(["attempt_number", "date", "deck_title", "overall_score", "report_id"]);
    expect(JSON.stringify(detail)).not.toMatch(/secret headline|private words/);
    expect(detail.ratings[0]).toMatchObject({ deck_title: "B deck", stars: 5, comment: "great" });
    const rat = (await db.q(ADMIN, "select public.admin_ratings(null) r", []))[0].r;
    expect(rat.count).toBe(2);
    expect(Number(rat.average)).toBe(4.5);
    expect((await db.q(ADMIN, "select public.admin_ratings(5) r"))[0].r.rows).toHaveLength(1);
    await expectCode(db.q(ADMIN, "select public.admin_student_detail($1)", [ADMIN]), "not_found"); // admin is not a student
  });
  it("searches case-insensitively and treats % and _ literally", async () => {
    await db.admin.query("update public.profiles set college='NIT_Trichy 100%' where id=$1", [A]);
    expect(await db.q(ADMIN, "select * from public.admin_list_students('STUDENT.A',10,0)")).toHaveLength(1);
    expect(await db.q(ADMIN, "select * from public.admin_list_students('nit_trichy 100%',10,0)")).toHaveLength(1);
    expect(await db.q(ADMIN, "select * from public.admin_list_students('%',10,0)")).toHaveLength(1);
    expect(await db.q(ADMIN, "select * from public.admin_list_students('zzz',10,0)")).toHaveLength(0);
    expect((await db.q(ADMIN, "select * from public.admin_list_students(null,2,0)"))[0].total_count).toBe("3");
  });
  it("sessions per day is zero-filled, in IST, N days", async () => {
    const r = await db.q(ADMIN, "select day::text d, count from public.admin_sessions_per_day(14)");
    expect(r).toHaveLength(14);
    expect(r.reduce((a, x) => a + x.count, 0)).toBe(1);
    expect(r.filter((x) => x.count === 0)).toHaveLength(13);
  });
  it("block / unblock works, is logged, and cannot target an admin", async () => {
    await db.q(ADMIN, "select public.admin_set_blocked($1,true)", [B]);
    expect((await db.admin.query("select is_blocked, blocked_at is not null b from public.profiles where id=$1", [B])).rows[0]).toEqual({ is_blocked: true, b: true });
    await expectCode(db.q(B, "select public.check_can_practise()"), "blocked");
    await db.q(ADMIN, "select public.admin_set_blocked($1,false)", [B]);
    await db.q(B, "select public.check_can_practise()");
    await expectCode(db.q(ADMIN, "select public.admin_set_blocked($1,true)", [ADMIN]), "cannot_block_admin");
    await expectCode(db.q(ADMIN, "select public.admin_set_blocked(gen_random_uuid(),true)"), "not_found");
    expect((await db.admin.query("select action from public.admin_actions order by id")).rows.map((r) => r.action)).toEqual(["block", "unblock"]);
  });
  it("AI usage: per slot used/remaining/low flag, zero-filled per-day, credit limit editable", async () => {
    const slot = (await db.admin.query("select id from public.ai_key_slots where purpose='slide_reading' and slot='primary'")).rows[0].id;
    await db.admin.query(`insert into public.ai_usage_log(purpose,key_slot_id,outcome) select 'slide_reading',$1,o from unnest(array['success','success','invalid_output','rate_limited','server_error','bad_request','timeout']) o`, [slot]);
    await db.q(ADMIN, "select public.admin_set_credit_limit($1,4,false)", [slot]);
    const u = (await db.q(ADMIN, "select public.admin_ai_usage(7) u"))[0].u;
    expect(u.purposes.map((p: any) => p.purpose)).toEqual(["slide_reading", "speech_to_text", "report_generation"]);
    const s = u.purposes[0].slots[0];
    expect(s).toMatchObject({ slot: "primary", credit_limit: 4, used: 3, remaining: 1, percent_used: 75, running_low: false });
    await db.admin.query("insert into public.ai_usage_log(purpose,key_slot_id,outcome) values ('slide_reading',$1,'success')", [slot]);
    const s2 = (await db.q(ADMIN, "select public.admin_ai_usage(7) u"))[0].u.purposes[0].slots[0];
    expect(s2).toMatchObject({ used: 4, remaining: 0, percent_used: 100, running_low: true });
    expect(u.purposes[0].per_day).toHaveLength(7);
    expect(u.purposes[0].slots.map((x: any) => x.slot)).toEqual(["primary", "fallback_1", "fallback_2"]);
    expect(JSON.stringify(u)).not.toMatch(/nvapi|key_hint|secret/);
    // resetting the period zeroes the count
    await db.q(ADMIN, "select public.admin_set_credit_limit($1,1000,true)", [slot]);
    expect((await db.q(ADMIN, "select public.admin_ai_usage(7) u"))[0].u.purposes[0].slots[0].used).toBe(0);
    await expectCode(db.q(ADMIN, "select public.admin_set_credit_limit($1,-1,false)", [slot]), "invalid_limit");
    await expectCode(db.q(ADMIN, "select public.admin_set_credit_limit(gen_random_uuid(),5,false)"), "not_found");
  });
  it("cannot read AI usage log or key slots directly", async () => {
    await expectDenied(db.q(ADMIN, "select * from public.ai_usage_log"));
    await expectDenied(db.q(ADMIN, "select * from public.ai_key_slots"));
  });
});
