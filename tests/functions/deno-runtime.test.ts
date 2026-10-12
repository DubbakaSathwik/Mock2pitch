// Real Deno runtime checks (the production entrypoints + gRPC under Deno). Requires `deno` (installed as a dev dependency).
import { afterAll, describe, expect, it } from "vitest";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
const execFileP = promisify(execFile); // async: a sync exec would block the in-process mock server
import path from "node:path";
import net from "node:net";
import { PROTO_ROOT, startMockRiva } from "../helpers/mock-riva";

const root = path.resolve(__dirname, "../..");
const deno = path.join(root, "node_modules/.bin/deno");
const procs: ChildProcess[] = [];
afterAll(() => { for (const p of procs) p.kill("SIGKILL"); });

const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

async function serve(fn: string, env: Record<string, string>) {
  const port = await freePort();
  const p = spawn(deno, ["run", "-A", "--config", "supabase/functions/deno.json", `supabase/functions/${fn}/index.ts`], {
    cwd: root, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${port}`, ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  procs.push(p);
  let log = ""; p.stderr!.on("data", (d) => (log += d)); p.stdout!.on("data", (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    try { await fetch(`http://127.0.0.1:${port}/`, { method: "OPTIONS" }); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  return { url: `http://127.0.0.1:${port}/`, log: () => log, kill: () => p.kill("SIGKILL") };
}

const GOOD_ENV = {
  SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", INTERNAL_FUNCTION_SECRET: "internal-secret-0123456789",
  APP_ALLOWED_ORIGINS: "http://localhost:3000", R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "ak", R2_SECRET_ACCESS_KEY: "sk", R2_BUCKET: "b",
  NVIDIA_SLIDE_MODEL: "m1", NVIDIA_REPORT_MODEL: "m2", NVIDIA_ASR_FUNCTION_ID: "f",
};

describe("production entrypoints under real Deno", () => {
  it("fails fast with a safe message that names missing variables but never values", async () => {
    const s = await serve("asset-urls", { SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "super-secret-value-xyz" });
    const r = await fetch(s.url, { method: "POST" });
    expect(r.status).toBe(500);
    expect((await r.json()).error.code).toBe("misconfigured");
    expect(s.log()).toContain("R2_ACCOUNT_ID");
    expect(s.log()).not.toContain("super-secret-value-xyz");
    s.kill();
  }, 60_000);
  it("serves CORS preflight, rejects unauthenticated calls and the maintenance sweep without the secret", async () => {
    const s = await serve("maintenance-sweep", GOOD_ENV);
    const pre = await fetch(s.url, { method: "OPTIONS", headers: { Origin: "http://localhost:3000" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect((await fetch(s.url, { method: "OPTIONS", headers: { Origin: "https://evil.example" } })).headers.get("access-control-allow-origin")).toBeNull();
    const denied = await fetch(s.url, { method: "POST", body: "{}" });
    expect([denied.status, (await denied.json()).error.code]).toEqual([403, "forbidden"]);
    s.kill();
    const a = await serve("asset-urls", GOOD_ENV);
    expect((await fetch(a.url, { method: "POST", body: "{}" })).status).toBe(401);
    expect((await fetch(a.url, { method: "POST", headers: { Authorization: "Bearer not-a-real-jwt" }, body: "{}" })).status).toBe(401); // supabase-js getUser fails -> 401, never a crash
    a.kill();
  }, 90_000);
  it("grpc-js + protobuf loading works under Deno against a Riva-compatible server (Option A viability, locally)", async () => {
    const srv = await startMockRiva(() => [{ transcript: "deno grpc ok", words: [{ word: "deno", start_time: 5, end_time: 9 }] }]);
    try {
      const { stdout: out } = await execFileP(deno, ["run", "-A", "--config", "supabase/functions/deno.json", "tests/helpers/deno-riva.ts", srv.target, PROTO_ROOT], { cwd: root, encoding: "utf8", timeout: 60_000 });
      expect(JSON.parse(out.trim().split("\n").at(-1)!)).toEqual({ text: "deno grpc ok", words: [{ w: "deno", start_ms: 5, end_ms: 9 }] });
      expect(srv.calls[0]!.metadata).toMatchObject({ "function-id": "fn-deno", authorization: "Bearer key-deno" });
    } finally { await srv.stop(); }
  }, 90_000);
});
