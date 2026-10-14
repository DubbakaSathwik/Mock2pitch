// A local Riva-compatible gRPC server (same vendored protos) for tests.
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "node:path";

export const PROTO_ROOT = path.resolve(__dirname, "../../supabase/functions/_shared/riva");

export type MockRivaCall = { config: any; audioBytes: number; metadata: Record<string, string> };

export async function startMockRiva(handler: (call: MockRivaCall) => { transcript: string; words: { word: string; start_time: number; end_time: number }[] }[] | { code: number; message: string }) {
  const def = protoLoader.loadSync("riva/proto/riva_asr.proto", { includeDirs: [PROTO_ROOT], keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true });
  const pkg: any = grpc.loadPackageDefinition(def);
  const server = new grpc.Server();
  const calls: MockRivaCall[] = [];
  server.addService(pkg.nvidia.riva.asr.RivaSpeechRecognition.service, {
    Recognize: (call: any, cb: any) => {
      const md: Record<string, string> = {};
      for (const [k, v] of Object.entries(call.metadata.getMap())) md[k] = String(v);
      const c = { config: call.request.config, audioBytes: call.request.audio.length, metadata: md };
      calls.push(c);
      const out = handler(c);
      if (!Array.isArray(out)) return cb({ code: out.code, details: out.message });
      cb(null, { results: out.map((r) => ({ alternatives: [{ transcript: r.transcript, confidence: 0.9, words: r.words }], channel_tag: 1 })) });
    },
  });
  const port: number = await new Promise((res, rej) => server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (e, p) => (e ? rej(e) : res(p))));
  return { target: `127.0.0.1:${port}`, calls, stop: () => new Promise<void>((r) => server.tryShutdown(() => r())) };
}
