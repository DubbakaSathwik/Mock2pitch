import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { acceptLatest, createDb, expectCode, makeReadyDeck, readyStudent, type Db } from "./harness";

let db: Db;
const ownerId = async () => (await db.admin.query("select id from auth.users where email='owner@mock2pitch.test'")).rows[0]?.id ?? db.makeUser("owner@mock2pitch.test");
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

const consume = (uid: string, kind = "upload") => db.admin.query("select private.consume_daily_session($1,$2,null,null)", [uid, kind]);
const usedToday = async (uid: string) => (await db.admin.query("select private.sessions_used_today($1) n", [uid])).rows[0].n as number;

describe("IST day boundary", () => {
  it("maps instants to Asia/Kolkata calendar dates", async () => {
    const r = await db.admin.query(`select public.ist_date('2026-10-12 18:29:59+00') a, public.ist_date('2026-10-12 18:30:00+00') b,
      public.ist_date('2026-10-12 23:59:59+05:30') c, public.ist_date('2026-10-13 00:00:01+05:30') d`);
    expect(r.rows[0]).toMatchObject({}); // dates serialise as Date objects; compare as strings below
    const s = await db.admin.query(`select public.ist_date('2026-10-12 18:29:59+00')::text a, public.ist_date('2026-10-12 18:30:00+00')::text b,
      public.ist_date('2026-10-12 23:59:59+05:30')::text c, public.ist_date('2026-10-13 00:00:01+05:30')::text d`);
    expect(s.rows[0]).toEqual({ a: "2026-10-12", b: "2026-10-13", c: "2026-10-12", d: "2026-10-13" });
  });
  it("yesterday's (IST) usage does not count today", async () => {
    const u = await readyStudent(db, "ist@example.test");
    await db.admin.query("insert into public.usage_events(user_id,kind,local_date) select $1,'upload', public.ist_date(now()) - 1 from generate_series(1,5)", [u]);
    expect(await usedToday(u)).toBe(0);
    await consume(u);
    expect(await usedToday(u)).toBe(1);
  });
  it("next reset is the upcoming IST midnight", async () => {
    const u = await readyStudent(db, "reset@example.test");
    const r = await db.q(u, "select next_reset_at > now() ok, (next_reset_at at time zone 'Asia/Kolkata')::time::text t, next_reset_at - now() <= interval '24 hours' within_day from public.my_dashboard_stats()");
    expect(r[0]).toEqual({ ok: true, t: "00:00:00", within_day: true });
  });
});

describe("daily limit", () => {
  it("allows 5 and rejects the 6th", async () => {
    const u = await readyStudent(db, "five@example.test");
    for (let i = 0; i < 5; i++) await consume(u, i % 2 ? "retake" : "upload");
    await expect(consume(u)).rejects.toThrow("daily_limit_reached");
    expect(await usedToday(u)).toBe(5);
  });
  it("is race-safe: two concurrent consumes at count 4 -> exactly one succeeds", async () => {
    const u = await readyStudent(db, "race@example.test");
    for (let i = 0; i < 4; i++) await consume(u);
    const run = async () => {
      const c = new Client({ connectionString: (db.admin.options as any).connectionString });
      await c.connect();
      try { await c.query("select private.consume_daily_session($1,'upload',null,null)", [u]); return "ok"; }
      catch (e) { return (e as Error).message; } finally { await c.end(); }
    };
    const results = await Promise.all(Array.from({ length: 8 }, run));
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "daily_limit_reached")).toHaveLength(7);
    expect(await usedToday(u)).toBe(5);
  });
  it("attempt 1 does not consume; a retake does; restarting an unsubmitted attempt does not double-charge", async () => {
    const u = await readyStudent(db, "retake@example.test");
    const deck = await makeReadyDeck(db, u);
    const s1 = (await db.q(u, "select * from public.start_practice_session($1,5)", [deck]))[0];
    expect(s1).toMatchObject({ attempt_number: 1, status: "in_progress", total_minutes: 5 });
    expect(await usedToday(u)).toBe(0);
    // finish attempt 1
    await db.admin.query("update public.practice_sessions set status='completed' where id=$1", [s1.id]);
    const s2 = (await db.q(u, "select * from public.start_practice_session($1,5)", [deck]))[0];
    expect(s2.attempt_number).toBe(2);
    expect(await usedToday(u)).toBe(1);
    // abandon attempt 2 by restarting: same attempt number, no second charge
    const s2b = (await db.q(u, "select * from public.start_practice_session($1,6)", [deck]))[0];
    expect(s2b.attempt_number).toBe(2);
    expect(s2b.id).not.toBe(s2.id);
    expect(await usedToday(u)).toBe(1);
    const st = await db.admin.query("select status from public.practice_sessions where id=$1", [s2.id]);
    expect(st.rows[0].status).toBe("abandoned");
  });
  it("the pre-paid attempt 1 can start even when the upload used the 5th session", async () => {
    const u = await readyStudent(db, "fifth@example.test");
    for (let i = 0; i < 5; i++) await consume(u);
    const deck = await makeReadyDeck(db, u);
    const s = (await db.q(u, "select * from public.start_practice_session($1,3)", [deck]))[0];
    expect(s.attempt_number).toBe(1);
    await db.admin.query("update public.practice_sessions set status='completed' where id=$1", [s.id]);
    await expectCode(db.q(u, "select * from public.start_practice_session($1,3)", [deck]), "daily_limit_reached");
  });
  it("splits time by weight using the handoff formula", async () => {
    const u = await readyStudent(db, "split@example.test");
    const deck = await makeReadyDeck(db, u, [10, 20, 20]);
    const s = (await db.q(u, "select * from public.start_practice_session($1,5)", [deck]))[0];
    expect(s.suggested_seconds).toEqual([60, 120, 120]);
  });
  it("validates minutes and deck state/ownership", async () => {
    const u = await readyStudent(db, "val@example.test"); const o = await readyStudent(db, "val2@example.test");
    const deck = await makeReadyDeck(db, u);
    await expectCode(db.q(u, "select * from public.start_practice_session($1,0)", [deck]), "invalid_minutes");
    await expectCode(db.q(u, "select * from public.start_practice_session($1,21)", [deck]), "invalid_minutes");
    await expectCode(db.q(o, "select * from public.start_practice_session($1,5)", [deck]), "not_found");
    await db.admin.query("update public.decks set status='processing' where id=$1", [deck]);
    await expectCode(db.q(u, "select * from public.start_practice_session($1,5)", [deck]), "invalid_state");
  });
});

describe("assert_can_practise error codes", () => {
  it("returns distinct codes", async () => {
    const admin = await ownerId();
    await expectCode(db.q(admin, "select public.check_can_practise()"), "is_admin");
    const blocked = await readyStudent(db, "blocked@example.test");
    await db.admin.query("update public.profiles set is_blocked=true where id=$1", [blocked]);
    await expectCode(db.q(blocked, "select public.check_can_practise()"), "blocked");
    const noProfile = await db.makeUser("noprofile@example.test");
    await expectCode(db.q(noProfile, "select public.check_can_practise()"), "profile_incomplete");
    await db.admin.query("update public.profiles set college='C', year='3rd year', branch='IT' where id=$1", [noProfile]);
    await expectCode(db.q(noProfile, "select public.check_can_practise()"), "policy_not_accepted");
    await acceptLatest(db, noProfile);
    await db.q(noProfile, "select public.check_can_practise()");
    for (let i = 0; i < 5; i++) await consume(noProfile);
    await expectCode(db.q(noProfile, "select public.check_can_practise()"), "daily_limit_reached");
    await db.q(noProfile, "select public.check_can_practise(false, true)"); // limit check can be skipped
    await expectCode(db.q(null, "select public.check_can_practise()", [], "anon").catch((e) => { throw new Error(e.message.includes("permission denied") ? "not_authenticated" : e.message); }), "not_authenticated");
  });
});

describe("policy gating (D15)", () => {
  it("a new version blocks starting/uploading until accepted, but an in-progress session may still be submitted", async () => {
    const owner = await ownerId();
    const u = await readyStudent(db, "policy@example.test");
    const deck = await makeReadyDeck(db, u);
    const sess = (await db.q(u, "select * from public.start_practice_session($1,5)", [deck]))[0];
    expect((await db.q(u, "select public.has_accepted_latest_policy() a"))[0].a).toBe(true);

    const v2 = (await db.q(owner, "select * from public.admin_publish_policy('v1.1','new terms','new privacy','tweak')"))[0];
    expect((await db.q(u, "select public.has_accepted_latest_policy() a"))[0].a).toBe(false);
    await expectCode(db.q(u, "select * from public.start_practice_session($1,5)", [deck]), "policy_not_accepted");
    await expectCode(db.q(u, "select public.check_can_practise()"), "policy_not_accepted");
    // submit-time check (no policy requirement, no limit) still passes for the in-progress session
    await db.q(u, "select public.check_can_practise(false, false)");
    const still = await db.admin.query("select status from public.practice_sessions where id=$1", [sess.id]);
    expect(still.rows[0].status).toBe("in_progress");

    await expectCode(db.q(u, "select public.accept_policy($1)", [(await db.admin.query("select id from public.policy_versions where version_label='v1.0'")).rows[0].id]), "not_latest_policy");
    await db.q(u, "select public.accept_policy($1)", [v2.id]);
    await db.q(u, "select public.accept_policy($1)", [v2.id]); // idempotent
    expect((await db.q(u, "select count(*)::int n from public.policy_acceptances"))[0].n).toBe(2);
    await db.q(u, "select * from public.start_practice_session($1,5)", [deck]);
  });
  it("admin cannot accept; only admin can publish; labels must increase", async () => {
    const owner = await ownerId();
    const u = await readyStudent(db, "policy2@example.test");
    const latest = (await db.admin.query("select id, version_label from public.policy_versions order by published_at desc limit 1")).rows[0];
    await expectCode(db.q(owner, "select public.accept_policy($1)", [latest.id]), "is_admin");
    await expectCode(db.q(u, "select * from public.admin_publish_policy('v9.0','a','b')"), "forbidden");
    await expectCode(db.q(owner, "select * from public.admin_publish_policy($1,'a','b')", [latest.version_label]), "label_not_increasing");
    await expectCode(db.q(owner, "select * from public.admin_publish_policy('v0.1','a','b')"), "label_not_increasing");
    await expectCode(db.q(owner, "select * from public.admin_publish_policy('banana','a','b')"), "invalid_label");
    await expectCode(db.q(owner, "select * from public.admin_publish_policy('v9.1','','b')"), "invalid_body");
    await expectCode(db.q(owner, "select * from public.admin_publish_policy('v9.2',$1,'b')", ["x".repeat(50001)]), "invalid_body");
    const ok = await db.q(owner, "select * from public.admin_publish_policy('v10.0','a','b')");
    expect(ok[0].version_label).toBe("v10.0");
    const hist = await db.q(owner, "select version_label, is_live from public.admin_policy_versions()");
    expect(hist.filter((h) => h.is_live)).toEqual([{ version_label: "v10.0", is_live: true }]);
  });
  it("anonymous users can read the live policy text", async () => {
    const r = await db.q(null, "select version_label, terms_body from public.policy_versions where version_label='v1.0'", [], "anon");
    expect(r[0].terms_body.length).toBeGreaterThan(100);
  });
});
