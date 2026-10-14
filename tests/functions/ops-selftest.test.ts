import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEnv, SECRET, type Env_ } from "./harness";
import { opsSelftest } from "@shared/handlers/ops-selftest.ts";
import { TransportError } from "@shared/nvidia/router.ts";

let env: Env_;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.close(); });

const run = (check: string) => env.call(opsSelftest, { check }, { internal: true });
const step = (r: any, name: string) => r.json.data.steps.find((s: any) => s.name.includes(name));

describe("ops-selftest (operator diagnostics)", () => {
  it("is internal-only: no secret, wrong secret, or a user JWT -> 403; bad body -> 400", async () => {
    expect((await env.call(opsSelftest, { check: "env" })).status).toBe(403);
    const u = await env.user("st1@example.test");
    expect((await env.call(opsSelftest, { check: "env" }, { token: u.token })).status).toBe(403);
    const wrong = await opsSelftest(new Request("http://x", { method: "POST", headers: { "x-internal-secret": SECRET + "x" }, body: '{"check":"env"}' }), env.deps);
    expect(wrong.status).toBe(403);
    expect((await env.call(opsSelftest, { check: "everything" }, { internal: true })).status).toBe(400);
    expect((await env.call(opsSelftest, { check: "env", extra: 1 }, { internal: true })).status).toBe(400);
  });

  it("env: reports configuration without ever printing a secret", async () => {
    const r = await run("env");
    expect(r.status).toBe(200);
    expect(r.json.data.ok).toBe(true);
    for (const secret of ["slide-k0", "asr-k0", "rep-k0", "sekrit", SECRET, "service"]) expect(r.text).not.toContain(secret);
    expect(step(r, "key slots").detail.slide_reading).toEqual(["primary", "fallback_1", "fallback_2"]);
  });

  it("r2: round trip, signed type/length enforcement, GET, CORS and prefix delete all pass; leaves nothing behind", async () => {
    const r = await run("r2");
    const failed = r.json.data.steps.filter((s: any) => !s.ok);
    expect(failed).toEqual([]);
    expect(r.json.data.steps.length).toBe(7);
    expect(env.s3.keys().filter((k) => k.startsWith("healthcheck/"))).toEqual([]);
    expect(r.text).not.toMatch(/X-Amz-Signature|X-Amz-Credential|sekrit/);
  });

  it("nvidia: every configured key is tried, latency/usage/vision/size probe/ASR are reported", async () => {
    const r = await run("nvidia");
    const failed = r.json.data.steps.filter((s: any) => !s.ok);
    expect(failed).toEqual([]);
    expect(r.json.data.steps.filter((s: any) => s.name.includes("accepted by /v1/models")).length).toBe(9);
    expect(step(r, "report model: 5").detail.statuses).toEqual([200, 200, 200, 200, 200]);
    expect(step(r, "slide model: reads").detail.schema_valid).toBe("3/3");
    expect(Object.keys(step(r, "size probe").detail.http_status_by_image_size).length).toBeGreaterThan(0);
    expect(step(r, "speech-to-text").detail).toMatchObject({ audio_seconds: 6, fillers_in_script: 4 });
    for (const secret of ["slide-k0", "asr-k0", "rep-k0", "Bearer"]) expect(r.text).not.toContain(secret);
  });

  it("pipeline: a synthetic user runs upload-completion -> deck processing -> analysis -> report, then everything is cleaned up", async () => {
    const before = (await env.db.admin.query("select count(*)::int n from public.profiles")).rows[0].n;
    const r = await run("pipeline");
    const failed = r.json.data.steps.filter((s: any) => !s.ok);
    expect(failed).toEqual([]);
    const analyse = step(r, "session-analyse").detail;
    expect(analyse.report.scoring_version).toBe("v1");
    expect(analyse.formula_matches).toBe(true);
    expect(analyse.audio_deleted).toBe(true);
    expect(analyse.unrecorded_slide_has_row).toBe(true);
    expect((await env.db.admin.query("select count(*)::int n from public.profiles")).rows[0].n).toBe(before);
    expect((await env.db.admin.query("select count(*)::int n from public.decks where title='Selftest deck'")).rows[0].n).toBe(0);
    expect(env.s3.keys().filter((k) => k.startsWith("users/"))).toEqual(expect.not.arrayContaining([expect.stringContaining("selftest")]));
    // usage rows survive, anonymised
    expect((await env.db.admin.query("select count(*)::int n from public.ai_usage_log where user_id is null and outcome='success'")).rows[0].n).toBeGreaterThan(0);
  });

  it("pipeline failures are reported per step instead of throwing, and still clean up", async () => {
    for (const k of ["slide-k0", "slide-k1", "slide-k2"]) env.ai.chatStatus[k] = 503;
    await env.db.admin.query("update public.ai_key_slots set cooldown_until=null");
    const r = await run("pipeline");
    env.ai.chatStatus = {};
    expect(r.status).toBe(200);
    expect(r.json.data.ok).toBe(false);
    expect(step(r, "deck-process").ok).toBe(false);
    expect(step(r, "cleanup").ok).toBe(true);
    expect((await env.db.admin.query("select count(*)::int n from public.decks where title='Selftest deck'")).rows[0].n).toBe(0);
  });

  it("model overrides apply to every check, are validated, and never change the stored configuration", async () => {
    const r = await env.call(opsSelftest, { check: "env", slide_model: "meta/llama-3.2-90b-vision-instruct", report_model: "nvidia/some-model" }, { internal: true });
    expect(step(r, "models").detail).toMatchObject({ slide_reading: "meta/llama-3.2-90b-vision-instruct", report_generation: "nvidia/some-model" });
    expect((await env.call(opsSelftest, { check: "env", slide_model: "bad model; drop table" }, { internal: true })).status).toBe(400);
    const again = await run("env");
    expect(step(again, "models").detail.slide_reading).toBe("slide-model");
    // the override reaches the NVIDIA calls themselves
    env.ai.chatCalls.length = 0;
    await env.call(opsSelftest, { check: "nvidia", slide_model: "override-vision" }, { internal: true });
    expect(env.ai.chatCalls.some((c) => c.model === "override-vision")).toBe(true);
  });

  it("a speech-to-text runtime failure is reported with its real reason instead of a bare 'network'", async () => {
    const original = env.deps.asr;
    env.deps.asr = async () => { throw new TransportError("network", "Error: ENOENT riva_asr.proto"); };
    const r = await run("nvidia");
    env.deps.asr = original;
    const asr = step(r, "speech-to-text");
    expect(asr.ok).toBe(false);
    expect(asr.detail).toMatchObject({ transport_error: "network", reason: "Error: ENOENT riva_asr.proto" });
  });
});
