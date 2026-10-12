// Run under Deno: proves @grpc/grpc-js + the vendored Riva protos work in the Deno runtime (Option A).
import { recognizePcm } from "../../supabase/functions/_shared/riva/client.ts";
const [target, protoRoot] = Deno.args;
const t = await recognizePcm(new Uint8Array(32000), { protoRoot: protoRoot!, target: target!, insecure: true, functionId: "fn-deno", apiKey: "key-deno", timeoutMs: 15000 });
console.log(JSON.stringify(t));
Deno.exit(0);
