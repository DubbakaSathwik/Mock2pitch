import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("/api/health", () => {
  it("is healthy in mock mode with no backend configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
    const { GET } = await import("../../app/api/health/route");
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, mode: "mock", backend_configured: true });
  });
  it("is 503 in supabase mode until the public Supabase variables are set, and never prints them", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { GET } = await import("../../app/api/health/route");
    expect((await GET()).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-value");
    const ok = await GET();
    const text = await ok.text();
    expect(ok.status).toBe(200);
    expect(text).not.toContain("anon-key-value"); expect(text).not.toContain("x.supabase.co");
  });
});
