// ASR transport: in-process Riva gRPC (Option A). Imported lazily so other functions don't load grpc-js.
import { TransportError, type TransportResult } from "../nvidia/router.ts";
import type { AsrCall } from "../deps.ts";
import { recognizePcm, RivaError } from "../riva/client.ts";

export function grpcAsr(o: { functionId: string; target?: string; insecure?: boolean }): AsrCall {
  return async ({ pcm, key, timeoutMs }): Promise<TransportResult> => {
    try {
      const t = await recognizePcm(pcm, { functionId: o.functionId, apiKey: key, timeoutMs, target: o.target, insecure: o.insecure });
      return { status: 200, headers: {}, body: t, usage: { audioMs: Math.round(pcm.length / 32) } };
    } catch (e) {
      if (e instanceof RivaError) {
        if (e.httpStatus === 504) throw new TransportError("timeout");
        return { status: e.httpStatus, headers: {}, body: null };
      }
      // keep a short, content-free reason (error class + message) so operators can diagnose runtime problems
      throw new TransportError("network", `${(e as Error)?.name ?? "Error"}: ${String((e as Error)?.message ?? "").slice(0, 200)}`);
    }
  };
}
