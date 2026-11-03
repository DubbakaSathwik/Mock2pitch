import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEnv, testEnv, type Env_ } from "./harness";
import { adminDiagnose } from "@shared/handlers/admin-diagnose.ts";
import { SPEECH_TEXT } from "@shared/selftest/fixtures.ts";

let env: Env_;
let owner: { token: string };
beforeAll(async () => { env = await createEnv(); owner = await env.admin_(); });
afterAll(async () => { await env.close(); });

const run = (body: unknown) => env.call(adminDiagnose, body, { token: owner.token });

describe("admin-diagnose (owner-only API diagnosis)", () => {
  it("is owner-only: no login 401, a student 403, bad body 400", async () => {
    expect((await env.call(adminDiagnose, { target: "database" })).status).toBe(401);
    const u = await env.user("dg1@example.test");
    expect((await env.call(adminDiagnose, { target: "database" }, { token: u.token })).status).toBe(403);
    expect((await run({ target: "everything" })).status).toBe(400);
    expect((await run({ target: "database", extra: 1 })).status).toBe(400);
    expect((await run({ target: "gemini_slide", model: "bad model; drop" })).status).toBe(400);
  });

  it("database and storage presets pass and leave nothing behind", async () => {
    const db = (await run({ target: "database" })).json.data;
    expect(db).toMatchObject({ target: "database", ok: true, verdict: "pass" });
    expect(db.checks.every((c: any) => c.ok)).toBe(true);
    const st = (await run({ target: "storage" })).json.data;
    expect(st).toMatchObject({ ok: true, verdict: "pass" });
    expect(env.s3.keys().filter((k) => k.includes("diagnosis-"))).toEqual([]);
  });

  it("Gemini preset: sends the real slide prompt with an image, compares the shape, reports model, slot and time", async () => {
    env.ai.chatCalls.length = 0;
    const r = (await run({ target: "gemini_slide" })).json.data;
    expect(r).toMatchObject({ target: "gemini_slide", ok: true, verdict: "pass", http_status: 200, model: "slide-model", key: { slot: "primary", masked: "••••••••e-k0" } });
    expect(r.checks.map((c: any) => c.name)).toEqual(expect.arrayContaining(["valid JSON in the expected shape", "slide 1 present", "has key points", "has a script"]));
    expect(r.actual).toContain("key points");
    expect(r.ms).toBeGreaterThanOrEqual(0);
    const call = env.ai.chatCalls[0]!;
    expect(call.key).toBe("slide-k0");
    expect(call.messages[1].content.some((p: any) => p.type === "image_url")).toBe(true);
    expect(JSON.stringify(r)).not.toContain("slide-k0"); // the key itself is never returned
  });

  it("can test another key slot and a candidate model without changing the stored secrets", async () => {
    env.ai.chatCalls.length = 0;
    const r = (await run({ target: "gemini_slide", slot: "fallback_1", model: "slide-fallback" })).json.data;
    expect(r.key.slot).toBe("fallback_1");
    expect(r.model).toBe("slide-fallback");
    expect(env.ai.chatCalls[0]).toMatchObject({ key: "slide-k1", model: "slide-fallback" });
    expect(testEnv.GEMINI_SLIDE_MODEL).toBe("slide-model");
  });

  it("custom prompt: shows the raw answer; an expectation is checked ('contains'), no expectation = unchecked", async () => {
    const r = (await run({ target: "nvidia_report", mode: "custom", prompt: "Say ping" })).json.data;
    expect(r).toMatchObject({ mode: "custom", verdict: "unchecked", http_status: 200 });
    expect(r.request).toContain("Say ping");
    expect(r.actual.length).toBeGreaterThan(0);
    const ok = (await run({ target: "nvidia_report", mode: "custom", prompt: "Say ping", expect: '"ok"' })).json.data;
    expect(ok).toMatchObject({ verdict: "pass" });
    const bad = (await run({ target: "nvidia_report", mode: "custom", prompt: "Say ping", expect: "this text is never there" })).json.data;
    expect(bad).toMatchObject({ ok: false, verdict: "fail" });
    expect(bad.checks.find((c: any) => c.name.includes("contains")).ok).toBe(false);
    expect((await run({ target: "nvidia_report", mode: "custom" })).json.data.error.reason).toContain("Type a prompt");
  });

  it("NVIDIA report preset checks the {\"ok\":true} answer", async () => {
    const r = (await run({ target: "nvidia_report" })).json.data;
    expect(r).toMatchObject({ verdict: "pass", model: "report-model" });
    expect(r.checks.some((c: any) => c.name.includes("ok"))).toBe(true);
  });

  it("speech-to-text preset compares the transcript with the known clip text", async () => {
    const orig = env.ai.transcript;
    env.ai.transcript = () => ({ text: SPEECH_TEXT, words: [] });
    const good = (await run({ target: "nvidia_asr" })).json.data;
    env.ai.transcript = () => ({ text: "completely different words here", words: [] });
    const bad = (await run({ target: "nvidia_asr" })).json.data;
    env.ai.transcript = orig;
    expect(good).toMatchObject({ verdict: "pass" });
    expect(bad).toMatchObject({ verdict: "fail" });
    expect(bad.checks.find((c: any) => c.name.includes("transcript"))).toMatchObject({ ok: false });
  });

  it("failures come back as a plain-words reason, with the HTTP status, never as a server error", async () => {
    const cases: [number, string][] = [[404, "not_found"], [429, "quota"], [503, "overloaded"], [401, "bad_key"]];
    for (const [status, kind] of cases) {
      env.ai.chatStatus = { "slide-k0": status };
      const res = await run({ target: "gemini_slide" });
      env.ai.chatStatus = {};
      expect(res.status).toBe(200);
      expect(res.json.data).toMatchObject({ ok: false, verdict: "fail", http_status: status, error: { kind } });
      expect(res.json.data.error.reason.length).toBeGreaterThan(20);
      expect(res.json.data.error.hint.length).toBeGreaterThan(10);
    }
    env.ai.asrStatus = { "asr-k0": 503 };
    const asr = (await run({ target: "nvidia_asr" })).json.data;
    env.ai.asrStatus = {};
    expect(asr).toMatchObject({ verdict: "fail", http_status: 503, error: { kind: "overloaded" } });
  });

  it("a missing key is reported as 'not configured'", async () => {
    const saved = env.deps.env;
    env.deps.env = { ...testEnv, GEMINI_SLIDE_KEY_FALLBACK_2: undefined };
    const r = (await run({ target: "gemini_slide", slot: "fallback_2" })).json.data;
    env.deps.env = saved;
    expect(r).toMatchObject({ verdict: "fail", error: { kind: "not_configured" } });
    expect(r.error.reason).toContain("fallback_2");
  });
});
