import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "../../app/api/internal/transcribe/route";
import { PROTO_ROOT, startMockRiva } from "../helpers/mock-riva";
import { routeAsr } from "@shared/ai/asr-route.ts";

const SECRET = "internal-secret-0123456789";
let srv: Awaited<ReturnType<typeof startMockRiva>>;
beforeAll(async () => {
  srv = await startMockRiva((c) => (c.metadata["authorization"] === "Bearer bad" ? { code: 16, message: "no" } : [{ transcript: "route works um", words: [{ word: "route", start_time: 0, end_time: 10 }] }]));
  process.env.INTERNAL_TRANSCRIBE_SECRET = SECRET;
  process.env.RIVA_PROTO_ROOT = PROTO_ROOT; process.env.RIVA_TARGET_OVERRIDE = srv.target; process.env.RIVA_INSECURE_TEST = "1";
});
afterAll(async () => { await srv.stop(); });

const req = (o: { secret?: string | null; key?: string | null; body?: Uint8Array } = {}) => {
  const h: Record<string, string> = { "x-asr-function-id": "fn-1" };
  if (o.secret !== null) h["x-internal-secret"] = o.secret ?? SECRET;
  if (o.key !== null) h["x-asr-key"] = o.key ?? "good";
  return new Request("http://x/api/internal/transcribe", { method: "POST", headers: h, body: (o.body ?? new Uint8Array(3200)) as unknown as BodyInit });
};

describe("internal transcribe route", () => {
  it("is invisible (404) without the shared secret or with a wrong one", async () => {
    expect((await POST(req({ secret: null }))).status).toBe(404);
    expect((await POST(req({ secret: SECRET + "x" }))).status).toBe(404);
  });
  it("transcribes via gRPC with the caller-supplied key and function id", async () => {
    const r = await POST(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: "route works um", words: [{ w: "route", start_ms: 0, end_ms: 10 }] });
    expect(srv.calls.at(-1)!.metadata).toMatchObject({ "function-id": "fn-1", authorization: "Bearer good" });
  });
  it("requires key + function id, caps the body size, and maps gRPC errors to statuses", async () => {
    expect((await POST(req({ key: null }))).status).toBe(400);
    expect((await POST(req({ body: new Uint8Array(60 * 32_000 + 70_000) }))).status).toBe(413);
    const bad = await POST(req({ key: "bad" }));
    expect(bad.status).toBe(401);
    expect(JSON.stringify(await bad.json())).not.toContain("bad");
  });
  it("end to end with the Edge-side transport: statuses flow into the key router's inputs", async () => {
    const asr = routeAsr({ url: "http://x/api/internal/transcribe", secret: SECRET, functionId: "fn-1", fetchFn: ((url: string, init: RequestInit) => POST(new Request(url, init))) as unknown as typeof fetch });
    const ok = await asr({ pcm: new Uint8Array(6400), key: "good", timeoutMs: 5000 });
    expect(ok.status).toBe(200); expect((ok.body as any).text).toContain("route works");
    expect(ok.usage?.audioMs).toBe(200);
    expect((await asr({ pcm: new Uint8Array(6400), key: "bad", timeoutMs: 5000 })).status).toBe(401);
  });
});
