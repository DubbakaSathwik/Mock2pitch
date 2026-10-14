// Internal speech-to-text bridge (gRPC Option B). Callable ONLY by the session-analyse Edge Function (shared secret).
// Body: raw 16 kHz mono 16-bit PCM (<= 60 s). Headers: x-internal-secret, x-asr-key, x-asr-function-id, [x-asr-timeout-ms].
import { timingSafeEqual } from "node:crypto";
import { recognizePcm, RivaError } from "@shared/riva/client.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 60 * 32_000 + 64_000; // 60 s of PCM plus slack

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function secretOk(given: string | null): boolean {
  const want = process.env.INTERNAL_TRANSCRIBE_SECRET ?? "";
  if (want.length < 16 || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  if (!secretOk(req.headers.get("x-internal-secret"))) return json({ ok: false }, 404); // do not advertise the route
  const key = req.headers.get("x-asr-key");
  const functionId = req.headers.get("x-asr-function-id");
  if (!key || !functionId) return json({ ok: false, error: "bad_request" }, 400);
  const pcm = new Uint8Array(await req.arrayBuffer());
  if (pcm.length > MAX_BYTES) return json({ ok: false, error: "too_large" }, 413);
  const timeoutMs = Math.min(Math.max(Number(req.headers.get("x-asr-timeout-ms")) || 25_000, 1_000), 55_000);
  try {
    const t = await recognizePcm(pcm, {
      functionId, apiKey: key, timeoutMs,
      target: process.env.RIVA_TARGET_OVERRIDE, insecure: process.env.RIVA_INSECURE_TEST === "1",
    });
    return json(t, 200);
  } catch (e) {
    return json({ ok: false, error: "asr_failed" }, e instanceof RivaError ? e.httpStatus : 503); // status drives the caller's key routing
  }
}
