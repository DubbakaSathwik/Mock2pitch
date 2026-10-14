import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, keysFor, keyEnvName, modelFor } from "@shared/env.ts";

const base = {
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key", INTERNAL_FUNCTION_SECRET: "0123456789abcdef",
  APP_ALLOWED_ORIGINS: "http://localhost:3000", R2_ACCOUNT_ID: "1", R2_ACCESS_KEY_ID: "2", R2_SECRET_ACCESS_KEY: "3", R2_BUCKET: "b",
  NVIDIA_SLIDE_MODEL: "m1", NVIDIA_REPORT_MODEL: "m2", NVIDIA_ASR_FUNCTION_ID: "f",
};
afterEach(() => { vi.resetModules(); vi.unstubAllEnvs(); });

describe("Edge Function env (Zod)", () => {
  it("fails fast naming the missing variables but never printing values", async () => {
    vi.resetModules();
    const { getEnv: fresh } = await import("@shared/env.ts");
    expect(() => fresh({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key" })).toThrow(/R2_ACCOUNT_ID/);
    try { fresh({ SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key" }); } catch (e) { expect((e as Error).message).not.toContain("super-secret-service-key"); }
  });
  it("applies defaults, trims optional keys, and builds ordered key pools skipping empty slots", async () => {
    vi.resetModules();
    const m = await import("@shared/env.ts");
    const env = m.getEnv({ ...base, NVIDIA_SLIDE_KEY_PRIMARY: " k0 ", NVIDIA_SLIDE_KEY_FALLBACK_1: "", NVIDIA_SLIDE_KEY_FALLBACK_2: "k2" });
    expect(env.NVIDIA_KEY_RPM_SOFT_LIMIT).toBe(35);
    expect(m.keysFor(env, "slide_reading")).toEqual([{ slot: "primary", key: "k0" }, { slot: "fallback_2", key: "k2" }]);
    expect(m.keysFor(env, "report_generation")).toEqual([]);
    expect(m.modelFor(env, "speech_to_text")).toBe("parakeet-tdt-0.6b-v2");
    expect(m.allowedOrigins({ ...env, APP_ALLOWED_ORIGINS: "http://a , https://b" })).toEqual(["http://a", "https://b"]);
  });
  it("maps purposes/slots to the documented variable names", () => {
    expect(keyEnvName("slide_reading", "primary")).toBe("NVIDIA_SLIDE_KEY_PRIMARY");
    expect(keyEnvName("speech_to_text", "fallback_1")).toBe("NVIDIA_ASR_KEY_FALLBACK_1");
    expect(keyEnvName("report_generation", "fallback_2")).toBe("NVIDIA_REPORT_KEY_FALLBACK_2");
    void getEnv; void keysFor; void modelFor;
  });
});

describe("Next.js env (Zod)", () => {
  it("clientEnv requires the public variables; serverEnv requires the secrets and refuses to run in a browser", async () => {
    const { clientEnv, serverEnv } = await import("../../lib/env");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); 
    expect(() => clientEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(clientEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc"); vi.stubEnv("INTERNAL_TRANSCRIBE_SECRET", "short");
    expect(() => serverEnv()).toThrow(/INTERNAL_TRANSCRIBE_SECRET/);
    try { serverEnv(); } catch (e) { expect((e as Error).message).not.toContain("short"); }
    vi.stubEnv("INTERNAL_TRANSCRIBE_SECRET", "0123456789abcdef");
    expect(serverEnv().SUPABASE_SERVICE_ROLE_KEY).toBe("svc");
    vi.stubGlobal("window", {});
    expect(() => serverEnv()).toThrow(/browser/);
    vi.unstubAllGlobals();
  });
});
