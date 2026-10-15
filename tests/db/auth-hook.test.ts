import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); });
afterAll(async () => { await db.close(); });

const ev = (provider: string | null, extra: object = {}) => JSON.stringify({ metadata: { name: "before-user-created" }, user: { email: "x@y.z", app_metadata: provider ? { provider, providers: [provider] } : {}, ...extra } });
const run = async (e: string) => (await db.admin.query("select public.hook_before_user_created($1::jsonb) as r", [e])).rows[0].r;

describe("before-user-created hook (Google-only sign-up)", () => {
  it("allows Google sign-ups", async () => { expect(await run(ev("google"))).toEqual({}); });
  it.each(["email", "phone", "github", "anonymous"])("rejects %s sign-ups with 403", async (p) => {
    const r = await run(ev(p));
    expect(r.error.http_code).toBe(403);
    expect(r.error.message).toMatch(/only available with Google/);
  });
  it("rejects events without a provider, and cannot be tricked via user_metadata", async () => {
    expect((await run(ev(null))).error.http_code).toBe(403);
    expect((await run(ev("email", { user_metadata: { provider: "google" } }))).error.http_code).toBe(403);
  });
  it("is not callable by API roles", async () => {
    await expect(db.q("00000000-0000-0000-0000-000000000001", "select public.hook_before_user_created('{}'::jsonb)", [], "authenticated")).rejects.toThrow(/permission denied/);
    await expect(db.q(null, "select public.hook_before_user_created('{}'::jsonb)", [], "anon")).rejects.toThrow(/permission denied/);
    await expect(db.q(null, "select public.hook_before_user_created('{}'::jsonb)", [], "service_role")).rejects.toThrow(/permission denied/);
  });
});

describe("auth.users guard trigger (defence in depth)", () => {
  const insertAs = async (role: string, email: string, provider: string, providers: string[] = [provider]) => {
    const c = await db.admin.connect();
    try {
      await c.query("begin");
      await c.query(`do $$ begin if not exists (select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin; end if; end $$`);
      await c.query("grant usage on schema auth to supabase_auth_admin; grant insert, select on auth.users to supabase_auth_admin; grant usage on schema public to supabase_auth_admin");
      await c.query(`set local role ${role}`);
      await c.query("insert into auth.users (id, aud, role, email, raw_app_meta_data) values (gen_random_uuid(), 'authenticated', 'authenticated', $1, $2::jsonb)", [email, JSON.stringify({ provider, providers })]);
      return "inserted";
    } catch (e) { return (e as Error).message; }
    finally { await c.query("rollback").catch(() => {}); c.release(); }
  };
  it("lets the Auth service create Google users", async () => { expect(await insertAs("supabase_auth_admin", "g@gmail.com", "google")).toBe("inserted"); });
  it("rejects email/password users created by the Auth service", async () => { expect(await insertAs("supabase_auth_admin", "x@gmail.com", "email")).toMatch(/signup_not_allowed/); });
  it("allows the reserved @mock2pitch.test domain through the Auth service (operator self-test)", async () => { expect(await insertAs("supabase_auth_admin", "selftest@mock2pitch.test", "email")).toBe("inserted"); });
  it("does not interfere with operator SQL inserts (test-user provisioning)", async () => { expect(await insertAs("postgres", "it@whatever.test", "email")).toBe("inserted"); });
});
