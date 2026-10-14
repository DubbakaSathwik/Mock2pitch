// Riva ASR (NVIDIA Cloud Functions, gRPC) client. Runs under Node (Next.js route) and Deno (Edge Function) via grpc-js.
import { Buffer } from "node:buffer";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { AUDIO_SAMPLE_RATE } from "../constants.ts";
import type { Transcript } from "../audio.ts";

export const RIVA_TARGET = "grpc.nvcf.nvidia.com:443";

export type RivaOptions = {
  protoRoot: string;            // directory containing riva/proto/*.proto
  functionId?: string;
  apiKey?: string;
  target?: string;
  insecure?: boolean;           // tests only (local mock server)
  timeoutMs?: number;
  languageCode?: string;
};

let cachedClientCtor: any;
function clientCtor(protoRoot: string) {
  if (cachedClientCtor?.root === protoRoot) return cachedClientCtor.ctor;
  const def = protoLoader.loadSync("riva/proto/riva_asr.proto", {
    includeDirs: [protoRoot], keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true,
  });
  const pkg: any = grpc.loadPackageDefinition(def);
  const ctor = pkg.nvidia.riva.asr.RivaSpeechRecognition;
  cachedClientCtor = { root: protoRoot, ctor };
  return ctor;
}

/** Offline recognition of one raw 16 kHz mono 16-bit PCM buffer (<= ~60 s recommended). */
export function recognizePcm(pcm: Uint8Array, o: RivaOptions): Promise<Transcript> {
  const Ctor = clientCtor(o.protoRoot);
  const creds = o.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl();
  const client = new Ctor(o.target ?? RIVA_TARGET, creds, { "grpc.max_receive_message_length": 16 * 1024 * 1024, "grpc.max_send_message_length": 16 * 1024 * 1024 });
  const md = new grpc.Metadata();
  if (o.functionId) md.set("function-id", o.functionId);
  if (o.apiKey) md.set("authorization", `Bearer ${o.apiKey}`);
  const request = {
    config: {
      encoding: "LINEAR_PCM", sample_rate_hertz: AUDIO_SAMPLE_RATE, language_code: o.languageCode ?? "en-US", max_alternatives: 1,
      audio_channel_count: 1, enable_word_time_offsets: true, enable_automatic_punctuation: true,
    },
    audio: Buffer.from(pcm),
  };
  return new Promise<Transcript>((resolve, reject) => {
    const deadline = new Date(Date.now() + (o.timeoutMs ?? 60_000));
    client.Recognize(request, md, { deadline }, (err: grpc.ServiceError | null, res: any) => {
      client.close();
      if (err) return reject(new RivaError(err.code, err.details || err.message));
      const texts: string[] = [];
      const words: Transcript["words"] = [];
      for (const r of res?.results ?? []) {
        const alt = r.alternatives?.[0];
        if (!alt) continue;
        if (alt.transcript) texts.push(String(alt.transcript).trim());
        for (const w of alt.words ?? []) words.push({ w: String(w.word), start_ms: Number(w.start_time), end_ms: Number(w.end_time) });
      }
      resolve({ text: texts.filter(Boolean).join(" "), words });
    });
  });
}

export class RivaError extends Error {
  constructor(public grpcCode: number, message: string) { super(message); }
  /** Map gRPC status to our router's HTTP-ish semantics. */
  get httpStatus(): number {
    switch (this.grpcCode) {
      case grpc.status.RESOURCE_EXHAUSTED: return 429;
      case grpc.status.UNAUTHENTICATED: return 401;
      case grpc.status.PERMISSION_DENIED: return 403;
      case grpc.status.INVALID_ARGUMENT: return 400;
      case grpc.status.DEADLINE_EXCEEDED: return 504;
      default: return 503;
    }
  }
}
