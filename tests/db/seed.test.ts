import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDb, expectCode, type Db } from "./harness";

let db: Db;
beforeAll(async () => {
  db = await createDb({ ownerEmail: null }); // the seed adds the local owner to the allowlist itself
  await db.admin.query(fs.readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8"));
});
afterAll(async () => { await db.close(); });

const id = async (email: string) => (await db.admin.query("select id from public.profiles where email=$1", [email])).rows[0].id as string;

describe("supabase/seed.sql (local dev)", () => {
  it("creates the five test accounts with the right roles", async () => {
    const r = await db.admin.query("select email, role, is_blocked, college is not null as has_profile from public.profiles order by email collate \"C\"");
    expect(r.rows).toEqual([
      { email: "owner@mock2pitch.test", role: "admin", is_blocked: false, has_profile: false },
      { email: "student.a@mock2pitch.test", role: "student", is_blocked: false, has_profile: true },
      { email: "student.b@mock2pitch.test", role: "student", is_blocked: false, has_profile: true },
      { email: "student.blocked@mock2pitch.test", role: "student", is_blocked: true, has_profile: true },
      { email: "student.new@mock2pitch.test", role: "student", is_blocked: false, has_profile: false },
    ]);
    expect((await db.admin.query("select count(*)::int n from auth.identities")).rows[0].n).toBe(5);
  });
  it("has an 8-slide ready deck, two completed attempts scored 62 and 74, and ratings", async () => {
    const a = await id("student.a@mock2pitch.test");
    const decks = await db.q(a, "select * from public.my_decks()");
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ title: "ParkSense", page_count: 8, pinned: true, attempts_count: 2, latest_score: 74 });
    const detail = await db.q(a, "select attempt_number, overall_score, delta_from_first from public.my_deck_detail($1)", [decks[0].deck_id]);
    expect(detail).toEqual([{ attempt_number: 1, overall_score: 62, delta_from_first: null }, { attempt_number: 2, overall_score: 74, delta_from_first: 12 }]);
    expect((await db.admin.query("select count(*)::int n from public.slides where deck_id=$1", [decks[0].deck_id])).rows[0].n).toBe(8);
    expect((await db.admin.query("select sum(time_weight)::int s from public.slides where deck_id=$1", [decks[0].deck_id])).rows[0].s).toBe(100);
  });
  it("seeded scores obey the documented formula (35/25/20/20)", async () => {
    const r = await db.admin.query("select overall_score, round(0.35*coverage_score + 0.25*clarity_score + 0.2*timing_score + 0.2*filler_score)::int calc from public.reports");
    for (const row of r.rows) expect(row.overall_score).toBe(row.calc);
  });
  it("gives the admin working aggregate views", async () => {
    const o = await id("owner@mock2pitch.test");
    expect((await db.q(o, "select * from public.admin_overview()"))[0]).toMatchObject({ total_students: 4, ratings_count: 2, sessions_all_time: 3 });
    expect((await db.q(o, "select * from public.admin_list_students(null,50,0)")).map((r) => r.attempts).sort()).toEqual([0, 0, 1, 2]);
    expect(Number((await db.q(o, "select public.admin_ratings(null) r"))[0].r.average)).toBe(4.5);
  });
  it("the special accounts behave as designed", async () => {
    await expectCode(db.q(await id("student.new@mock2pitch.test"), "select public.check_can_practise()"), "profile_incomplete");
    await expectCode(db.q(await id("student.blocked@mock2pitch.test"), "select public.check_can_practise()"), "blocked");
    await expectCode(db.q(await id("owner@mock2pitch.test"), "select public.check_can_practise()"), "is_admin");
    expect((await db.q(await id("student.b@mock2pitch.test"), "select sessions_used_today from public.my_dashboard_stats()"))[0].sessions_used_today).toBe(1);
  });
  it("contains no real-looking personal emails", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    const emails = [...sql.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]);
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every((e) => e.endsWith("@mock2pitch.test"))).toBe(true);
  });
});
