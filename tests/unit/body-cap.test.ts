import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_BODY_BYTES, readBody } from "@shared/handlers/common.ts";
import { AppError } from "@shared/http.ts";

const schema = z.object({ items: z.array(z.number()).max(10) }).strict();
const post = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request("http://fn.local/x", { method: "POST", body, headers, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) } as RequestInit);
const reject = async (req: Request) => readBody(req, schema).then(() => null, (e) => e as AppError);

describe("request body cap (readBody)", () => {
  it("still accepts normal bodies and keeps the old 400s for malformed / wrongly shaped JSON", async () => {
    expect(await readBody(post(JSON.stringify({ items: [1, 2, 3] })), schema)).toEqual({ items: [1, 2, 3] });
    expect((await reject(post("{not json")))?.status).toBe(400);
    expect((await reject(post(JSON.stringify({ items: "x" }))))?.status).toBe(400);
    expect((await reject(post(null)))?.status).toBe(400);
  });
  it("rejects a body that declares a size over the cap with 413, before reading it", async () => {
    const big = JSON.stringify({ items: [], pad: "x".repeat(MAX_BODY_BYTES + 10) });
    const e = await reject(post(big));
    expect([e?.status, e?.code]).toEqual([413, "body_too_large"]);
  });
  it("rejects an oversized body even when content-length is absent or lies (chunked stream)", async () => {
    const chunk = new TextEncoder().encode("x".repeat(8 * 1024));
    let sent = 0, pulled = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { pulled++; if (sent > 10 * MAX_BODY_BYTES) return c.close(); sent += chunk.length; c.enqueue(chunk); } });
    const e = await reject(post(stream, { "content-length": "10" }));
    expect([e?.status, e?.code]).toEqual([413, "body_too_large"]);
    expect(sent).toBeLessThan(2 * MAX_BODY_BYTES); // it stopped reading at the cap instead of draining the whole stream
    expect(pulled).toBeGreaterThan(0);
  });
  it("accepts a body exactly at the cap boundary shape-wise (cap is on bytes, not on valid JSON)", async () => {
    const e = await reject(post("x".repeat(MAX_BODY_BYTES)));
    expect(e?.status).toBe(400); // under/at the cap: reaches JSON parsing and fails as malformed, not as too large
  });
});
