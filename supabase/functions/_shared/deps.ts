// Dependency container. Handlers are plain (Request, Deps) => Response so they run under Deno (prod) and Node/Vitest (tests).
import type { Env } from "./env.ts";
import type { R2 } from "./r2.ts";
import type { Transport } from "./nvidia/router.ts";

// Structural subset of SupabaseClient used by handlers (kept loose so a test double can stand in).
// deno-lint-ignore no-explicit-any
export type Sb = any;

export type AsrCall = (req: { pcm: Uint8Array; key: string; timeoutMs: number }) => ReturnType<Transport>;

export interface Deps {
  env: Env;
  /** Client acting as the caller (anon key + the caller's JWT): RLS and auth.uid() apply. */
  userClient(jwt: string): Sb;
  /** Service-role client: only after authorisation. */
  admin: Sb;
  r2: R2;
  /** Keep work running after the response is returned (EdgeRuntime.waitUntil). */
  background(p: Promise<unknown>): void;
  fetchFn: typeof fetch;
  /** One Riva recognition call over a <= 60 s PCM chunk (gRPC in-process, or via the Next.js internal route). */
  asr: AsrCall;
  /** Fire an internal function-to-function call (sweeper resumes, stage chaining). */
  invoke(fn: string, body: Record<string, unknown>): Promise<void>;
  now(): Date;
}

export type Ctx = { req: Request; deps: Deps; cors: Record<string, string> };
