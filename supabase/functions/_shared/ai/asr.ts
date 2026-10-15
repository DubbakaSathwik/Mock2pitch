// Speech-to-text orchestration: chunk -> route each chunk through the key router -> merge with offset-corrected timestamps.
import type { AsrCall, Deps } from "../deps.ts";
import { routeCall, type RouterStore } from "../nvidia/router.ts";
import { keysFor, modelFor } from "../env.ts";
import { mergeTranscripts, splitPcm, type Transcript } from "../audio.ts";
import { TIMEOUT_ASR_MS } from "../constants.ts";

export const ASR_CHUNK_MS = 60_000;

function asTranscript(body: unknown): Transcript {
  const b = body as Transcript;
  if (!b || typeof b.text !== "string" || !Array.isArray(b.words)) throw new Error("bad_asr_body");
  return b;
}

export async function transcribePcm(deps: Deps, store: RouterStore, pcm: Uint8Array, ctx: { userId: string; sessionId: string }): Promise<Transcript> {
  const chunks = splitPcm(pcm, ASR_CHUNK_MS);
  const parts: { offsetMs: number; t: Transcript }[] = [];
  for (const c of chunks) { // sequential per clip; clips run in parallel (bounded) by the caller
    const t = await routeCall({
      purpose: "speech_to_text", model: modelFor(deps.env, "speech_to_text"), keys: keysFor(deps.env, "speech_to_text"), store,
      transport: ({ key, timeoutMs }) => deps.asr({ pcm: c.pcm, key, timeoutMs }),
      timeoutMs: TIMEOUT_ASR_MS, rpmSoftLimit: deps.env.NVIDIA_KEY_RPM_SOFT_LIMIT, ctx, sleep: deps.sleep,
      validate: asTranscript,
    });
    parts.push({ offsetMs: c.offsetMs, t });
  }
  return mergeTranscripts(parts);
}

export type { AsrCall };
