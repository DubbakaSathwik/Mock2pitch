import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEnv, ORIGIN, testEnv, type Env_ } from "./harness";
import { health } from "@shared/handlers/health.ts";

let env: Env_;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.close(); });

const get = (headers: Record<string, string> = {}) => health(new Request("http://fn.local/health", { method: "GET", headers }), env.deps);

describe("health (public liveness + configuration probe)", () => {
  it("is healthy with a migrated database, reachable storage and a primary key for every purpose", async () => {
    const r = await get({ Origin: ORIGIN });
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data.checks.database).toMatchObject({ ok: true, detail: { key_slots: 9 } });
    expect(j.data.checks.storage.ok).toBe(true);
    expect(j.data.checks.ai.purposes.slide_reading).toEqual({ keys_configured: 3, primary_configured: true });
    expect(j.data.checks.ai.slide_reader).toBe("gemini");
  });

  it("answers POST and the CORS preflight too, and rejects other methods", async () => {
    expect((await health(new Request("http://x", { method: "POST" }), env.deps)).status).toBe(200);
    const pre = await health(new Request("http://x", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env.deps);
    expect(pre.status).toBe(204);
    expect((await health(new Request("http://x", { method: "DELETE" }), env.deps)).status).toBe(405);
  });

  it("never leaks keys, key names, model ids, secrets or the bucket", async () => {
    const text = await (await get()).text();
    for (const secret of ["slide-k0", "asr-k0", "rep-k0", "sekrit", "slide-model", "report-model", "m2p-test", "internal-secret", "AKIATEST"]) expect(text).not.toContain(secret);
  });

  it("answers repeat calls from a short-lived cache so an anonymous caller cannot hammer the database and R2", async () => {
    const admin = env.deps.admin; const r2 = env.deps.r2;
    let dbCalls = 0, r2Calls = 0;
    env.deps.admin = { from: (t: string) => { dbCalls++; return (admin as any).from(t); } } as any;
    (env.deps as { r2: unknown }).r2 = { head: async (k: string) => { r2Calls++; return (r2 as any).head(k); } };
    try {
      const results = [];
      for (let i = 0; i < 25; i++) results.push((await get()).status);
      expect(results.every((s) => s === 200)).toBe(true);
      expect([dbCalls, r2Calls]).toEqual([1, 1]); // 25 requests, one real probe
    } finally { env.deps.admin = admin; (env.deps as { r2: unknown }).r2 = r2; }
  });

  it("turns unhealthy (503) when the Gemini primary key is missing, and says which purpose", async () => {
    const saved = env.deps.env;
    env.deps.env = { ...testEnv, GEMINI_SLIDE_KEY_PRIMARY: undefined };
    const r = await get();
    env.deps.env = saved;
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(j.data.checks.ai.purposes.slide_reading.primary_configured).toBe(false);
    expect(j.data.checks.database.ok).toBe(true);
  });

  it("turns unhealthy (503) when the database or storage fails, without echoing the error", async () => {
    const admin = env.deps.admin; const r2 = env.deps.r2;
    env.deps.admin = { from: () => ({ select: async () => ({ data: null, error: { message: "password authentication failed for user postgres" } }) }) };
    (env.deps as { r2: unknown }).r2 = { head: async () => { throw new Error("SignatureDoesNotMatch AKIASECRET"); } };
    const res = await get(); const text = await res.text();
    env.deps.admin = admin; (env.deps as { r2: unknown }).r2 = r2;
    expect(res.status).toBe(503);
    expect(text).not.toMatch(/password|AKIASECRET|Signature/);
    expect(JSON.parse(text).data.checks).toMatchObject({ database: { ok: false }, storage: { ok: false } });
  });
});
