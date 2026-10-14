import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, expectDenied, expectCode, type Db } from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

describe("profile trigger + owner allowlist", () => {
  it("creates a student profile with Google metadata", async () => {
    const id = await db.makeUser("someone@example.test", { name: "Some One" });
    const r = await db.admin.query("select * from public.profiles where id=$1", [id]);
    expect(r.rows[0]).toMatchObject({ email: "someone@example.test", full_name: "Some One", role: "student", avatar_url: "https://example.test/p.png", is_blocked: false });
  });
  it("promotes an allowlisted, verified email to admin (case-insensitive)", async () => {
    const id = await db.makeUser("OWNER@mock2pitch.test");
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("admin");
  });
  it("does NOT promote an allowlisted but unverified email, until it is confirmed", async () => {
    await db.admin.query("insert into private.owner_allowlist(email) values ('late@mock2pitch.test')");
    const id = await db.makeUser("late@mock2pitch.test", { confirmed: false });
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("student");
    await db.admin.query("update auth.users set email_confirmed_at = now() where id=$1", [id]);
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("admin");
  });
  it("sync_owner_role promotes an account that signed in before being allowlisted", async () => {
    const id = await db.makeUser("early@mock2pitch.test");
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("student");
    await db.admin.query("insert into private.owner_allowlist(email) values ('early@mock2pitch.test')");
    await db.admin.query("select private.sync_owner_role('early@mock2pitch.test')");
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("admin");
  });
  it("non-allowlisted emails stay students", async () => {
    const id = await db.makeUser("random@example.test");
    expect((await db.admin.query("select role from public.profiles where id=$1", [id])).rows[0].role).toBe("student");
  });
  it("the allowlist is not readable through the API roles", async () => {
    const id = await db.makeUser("peek@example.test");
    await expectDenied(db.q(id, "select * from private.owner_allowlist"), "permission denied for schema private");
    await expectDenied(db.q(null, "select * from private.owner_allowlist", [], "anon"), "permission denied for schema private");
  });
});

describe("clients cannot escalate via profile updates", () => {
  it("allows name/college/year/branch only", async () => {
    const id = await db.makeUser("edit@example.test");
    await db.q(id, "update public.profiles set full_name='New', college='IIT', year='4th year', branch='ECE' where id=$1", [id]);
    const r = await db.admin.query("select * from public.profiles where id=$1", [id]);
    expect(r.rows[0]).toMatchObject({ full_name: "New", college: "IIT", year: "4th year", branch: "ECE" });
    expect(r.rows[0].profile_completed_at).not.toBeNull();
  });
  it.each(["role='admin'", "is_blocked=false", "email='x@y.z'", "blocked_at=now()", "last_active_at=now()", "avatar_url='x'", "profile_completed_at=now()", "deletion_requested_at=now()", "id=gen_random_uuid()"])(
    "denies direct update of %s", async (set) => {
      const id = await db.makeUser(`esc-${Math.random()}@example.test`);
      await expectDenied(db.q(id, `update public.profiles set ${set} where id=$1`, [id]));
    });
  it("validates enum and length constraints", async () => {
    const id = await db.makeUser("bad@example.test");
    await expect(db.q(id, "update public.profiles set year='5th year' where id=$1", [id])).rejects.toThrow(/check constraint/);
    await expect(db.q(id, "update public.profiles set branch='Chemical' where id=$1", [id])).rejects.toThrow(/check constraint/);
    await expect(db.q(id, "update public.profiles set college='' where id=$1", [id])).rejects.toThrow(/check constraint/);
    await expect(db.q(id, "update public.profiles set college=$2 where id=$1", [id, "x".repeat(121)])).rejects.toThrow(/check constraint/);
  });
  it("a student cannot update someone else's profile (RLS hides the row)", async () => {
    const a = await db.makeUser("a1@example.test"); const b = await db.makeUser("b1@example.test");
    const r = await db.asUser(a, (c) => c.query("update public.profiles set full_name='hacked' where id=$1", [b]));
    expect(r.rowCount).toBe(0);
  });
  it("a blocked student cannot update their profile but can read it", async () => {
    const id = await db.makeUser("blk@example.test");
    await db.admin.query("update public.profiles set is_blocked=true where id=$1", [id]);
    const r = await db.asUser(id, (c) => c.query("update public.profiles set full_name='x' where id=$1", [id]));
    expect(r.rowCount).toBe(0);
    expect((await db.q(id, "select id from public.profiles")).length).toBe(1);
  });
  it("is_admin() reads the DB, not the client", async () => {
    const s = await db.makeUser("stu@example.test");
    const o = await db.makeUser("owner@mock2pitch.test");
    expect((await db.q(s, "select public.is_admin() a"))[0].a).toBe(false);
    expect((await db.q(o, "select public.is_admin() a"))[0].a).toBe(true);
    await expectDenied(db.q(null, "select public.is_admin()", [], "anon"));
    // forged claim does not matter
    const r = await db.asUser(s, async (c) => { await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: s, role: "authenticated", app_metadata: { role: "admin" } })]); return (await c.query("select public.is_admin() a")).rows[0].a; });
    expect(r).toBe(false);
  });
  it("students calling admin RPCs get forbidden; anon is denied", async () => {
    const s = await db.makeUser("stu2@example.test");
    await expectCode(db.q(s, "select * from public.admin_overview()"), "forbidden");
    await expectDenied(db.q(null, "select * from public.admin_overview()", [], "anon"));
  });
});
