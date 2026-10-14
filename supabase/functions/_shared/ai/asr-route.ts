// ASR transport: via the Next.js internal transcribe route (Option B).
import { TransportError, type TransportResult } from "../nvidia/router.ts";
import type { AsrCall } from "../deps.ts";

export function routeAsr(o: { url: string; secret: string; functionId: string; fetchFn?: typeof fetch }): AsrCall {
  const f = o.fetchFn ?? fetch;
  return async ({ pcm, key, timeoutMs }): Promise<TransportResult> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs + 5000);
    try {
      const res = await f(o.url, {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/octet-stream", "x-internal-secret": o.secret, "x-asr-key": key, "x-asr-function-id": o.functionId, "x-asr-timeout-ms": String(timeoutMs) },
        body: pcm as unknown as BodyInit,
      });
      let body: unknown = null;
      try { body = await res.json(); } catch { /* non-JSON error body */ }
      return { status: res.status, headers: {}, body, usage: { audioMs: Math.round(pcm.length / 32) } };
    } catch (e) {
      throw new TransportError((e as Error)?.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  };
}
