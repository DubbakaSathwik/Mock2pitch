import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "@/lib/csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " "))!;

describe("Content-Security-Policy (per-request nonce)", () => {
  const csp = buildCsp({ nonce: "NONCE123", isDev: false, supabaseUrl: "https://abc.supabase.co" });

  it("does not allow inline or eval scripts in production: only the nonce", () => {
    const script = directive(csp, "script-src");
    expect(script).toContain("'nonce-NONCE123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toMatch(/\shttps?:|\s\*/); // no scheme / wildcard script sources
  });
  it("allows 'unsafe-eval' and the HMR socket only in development", () => {
    const dev = buildCsp({ nonce: "n", isDev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws://localhost:*");
    expect(csp).not.toContain("ws://localhost");
  });
  it("keeps the lock-down directives and only the expected remote origins", () => {
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co https://*.r2.cloudflarestorage.com");
    expect(directive(csp, "img-src")).toContain("https://lh3.googleusercontent.com");
  });
  it("generates a different nonce every time", () => {
    const set = new Set(Array.from({ length: 50 }, newNonce));
    expect(set.size).toBe(50);
    for (const n of set) expect(n.length).toBeGreaterThanOrEqual(40);
  });
});
