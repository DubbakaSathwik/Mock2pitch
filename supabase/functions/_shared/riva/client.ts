// Riva ASR (NVIDIA Cloud Functions, gRPC) client. Runs under Node (Next.js route) and Deno (Edge Function).
import { Buffer } from "node:buffer";
import http2 from "node:http2";
import * as protoLoader from "@grpc/proto-loader";
import { RIVA_DESCRIPTOR } from "./descriptor.ts";
import { AUDIO_SAMPLE_RATE } from "../constants.ts";
import type { Transcript } from "../audio.ts";

export const RIVA_TARGET = "grpc.nvcf.nvidia.com:443";

export type RivaOptions = {
  functionId?: string;
  apiKey?: string;
  target?: string;
  insecure?: boolean;           // tests only (local mock server)
  timeoutMs?: number;
  languageCode?: string;
};

// grpc-js's own channel never connects inside the Supabase Edge Runtime ("Waiting for LB pick" until the deadline) although
// node:http2 connects to the same host in ~15 ms. gRPC unary calls are plain HTTP/2 (POST, 5-byte message prefix, status in
// trailers), so we speak that directly over node:http2 and use protobufjs (via proto-loader) only to (de)serialise messages.
const GRPC_STATUS = { OK: 0, INVALID_ARGUMENT: 3, DEADLINE_EXCEEDED: 4, PERMISSION_DENIED: 7, RESOURCE_EXHAUSTED: 8, UNAUTHENTICATED: 16, UNAVAILABLE: 14, INTERNAL: 13 } as const;

let cachedDef: protoLoader.PackageDefinition | undefined;
// The protocol is embedded as a JSON descriptor (generated from the vendored .proto files): no file access at runtime.
function methodDef(name: "Recognize" | "GetRivaSpeechRecognitionConfig") {
  cachedDef ??= protoLoader.fromJSON(RIVA_DESCRIPTOR as any, { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true });
  return (cachedDef["nvidia.riva.asr.RivaSpeechRecognition"] as any)[name] as { path: string; requestSerialize(v: unknown): Buffer; responseDeserialize(b: Buffer): any };
}

type CallOpts = Pick<RivaOptions, "functionId" | "apiKey" | "target" | "insecure"> & { timeoutMs: number };

function unary(name: "Recognize" | "GetRivaSpeechRecognitionConfig", request: unknown, o: CallOpts): Promise<any> {
  const m = methodDef(name);
  const body = m.requestSerialize(request);
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 1);
  body.copy(frame, 5);
  const target = o.target ?? RIVA_TARGET;
  return new Promise((resolve, reject) => {
    let done = false;
    let session: http2.ClientHttp2Session | undefined;
    const finish = (err: RivaError | null, value?: unknown) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { session?.destroy(); } catch { /* already closed */ }
      if (err) reject(err); else resolve(value);
    };
    const timer = setTimeout(() => finish(new RivaError(GRPC_STATUS.DEADLINE_EXCEEDED, `Deadline exceeded after ${o.timeoutMs} ms`)), o.timeoutMs);
    try {
      session = http2.connect(`${o.insecure ? "http" : "https"}://${target}`);
      session.on("error", (e: Error) => finish(new RivaError(GRPC_STATUS.UNAVAILABLE, `${e.name}: ${e.message}`)));
      const headers: Record<string, string> = { ":method": "POST", ":path": m.path, "content-type": "application/grpc", te: "trailers", "grpc-accept-encoding": "identity", "user-agent": "mock2pitch-edge" };
      if (o.functionId) headers["function-id"] = o.functionId;
      if (o.apiKey) headers["authorization"] = `Bearer ${o.apiKey}`;
      const req = session.request(headers);
      const chunks: Buffer[] = [];
      let status: number | undefined; let message = "";
      const readStatus = (h: http2.IncomingHttpHeaders) => {
        if (h["grpc-status"] !== undefined) status = Number(h["grpc-status"]);
        if (h["grpc-message"] !== undefined) { try { message = decodeURIComponent(String(h["grpc-message"])); } catch { message = String(h["grpc-message"]); } }
      };
      req.on("response", (h) => { readStatus(h); if (status === undefined && h[":status"] && Number(h[":status"]) !== 200) { status = Number(h[":status"]) === 401 ? GRPC_STATUS.UNAUTHENTICATED : Number(h[":status"]) === 403 ? GRPC_STATUS.PERMISSION_DENIED : Number(h[":status"]) === 429 ? GRPC_STATUS.RESOURCE_EXHAUSTED : GRPC_STATUS.UNAVAILABLE; message = `HTTP ${h[":status"]}`; } });
      req.on("trailers", readStatus);
      req.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      req.on("error", (e: Error) => finish(new RivaError(GRPC_STATUS.UNAVAILABLE, `${e.name}: ${e.message}`)));
      req.on("end", () => {
        if (status === undefined) return finish(new RivaError(GRPC_STATUS.UNAVAILABLE, "stream ended without grpc-status"));
        if (status !== GRPC_STATUS.OK) return finish(new RivaError(status, message || `grpc status ${status}`));
        const buf = Buffer.concat(chunks);
        if (buf.length < 5 || buf[0] !== 0) return finish(new RivaError(GRPC_STATUS.INTERNAL, "empty or compressed response message"));
        const len = buf.readUInt32BE(1);
        if (buf.length < 5 + len) return finish(new RivaError(GRPC_STATUS.INTERNAL, "truncated response message"));
        try { finish(null, m.responseDeserialize(buf.subarray(5, 5 + len))); } catch (e) { finish(new RivaError(GRPC_STATUS.INTERNAL, `bad response: ${(e as Error).message}`)); }
      });
      req.end(frame);
    } catch (e) { finish(new RivaError(GRPC_STATUS.UNAVAILABLE, `${(e as Error)?.name}: ${(e as Error)?.message}`)); }
  });
}

/** Offline recognition of one raw 16 kHz mono 16-bit PCM buffer (<= ~60 s recommended). */
export async function recognizePcm(pcm: Uint8Array, o: RivaOptions): Promise<Transcript> {
  const request = {
    config: {
      encoding: "LINEAR_PCM", sample_rate_hertz: AUDIO_SAMPLE_RATE, language_code: o.languageCode ?? "en-US", max_alternatives: 1,
      audio_channel_count: 1, enable_word_time_offsets: true, enable_automatic_punctuation: true,
    },
    audio: Buffer.from(pcm),
  };
  const res = await unary("Recognize", request, { ...o, timeoutMs: o.timeoutMs ?? 60_000 });
  const texts: string[] = [];
  const words: Transcript["words"] = [];
  for (const r of res?.results ?? []) {
    const alt = r.alternatives?.[0];
    if (!alt) continue;
    if (alt.transcript) texts.push(String(alt.transcript).trim());
    for (const w of alt.words ?? []) words.push({ w: String(w.word), start_ms: Number(w.start_time), end_ms: Number(w.end_time) });
  }
  return { text: texts.filter(Boolean).join(" "), words };
}

/** Cheap connectivity probe: lists the ASR models the function serves. Fails fast if the channel/auth is broken. */
export async function getRivaConfig(o: Pick<RivaOptions, "functionId" | "apiKey" | "target" | "insecure" | "timeoutMs">): Promise<string[]> {
  const res = await unary("GetRivaSpeechRecognitionConfig", {}, { ...o, timeoutMs: o.timeoutMs ?? 15_000 });
  return (res?.model_config ?? []).map((m: { model_name: string }) => String(m.model_name));
}

export class RivaError extends Error {
  constructor(public grpcCode: number, message: string) { super(message); }
  /** Map gRPC status to our router's HTTP-ish semantics. */
  get httpStatus(): number {
    switch (this.grpcCode) {
      case GRPC_STATUS.RESOURCE_EXHAUSTED: return 429;
      case GRPC_STATUS.UNAUTHENTICATED: return 401;
      case GRPC_STATUS.PERMISSION_DENIED: return 403;
      case GRPC_STATUS.INVALID_ARGUMENT: return 400;
      case GRPC_STATUS.DEADLINE_EXCEEDED: return 504;
      default: return 503;
    }
  }
}
