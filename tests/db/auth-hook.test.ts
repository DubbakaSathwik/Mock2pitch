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
