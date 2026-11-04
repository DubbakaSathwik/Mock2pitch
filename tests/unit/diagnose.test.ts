import { describe, expect, it } from "vitest";
import { classifyHttp, classifyThrown, containsCheck, redact, upstreamMessage, wordOverlap } from "@shared/diagnose.ts";

describe("redact", () => {
  it("removes anything that looks like a key or token", () => {
    const k = "AIzaSyA1234567890abcdefghijklmnopqrstuv";
    expect(redact(`bad key ${k} here`)).toBe("bad key [redacted-google-key] here");
    expect(redact("key nvapi-AbCdEfGhIj1234567890 x")).toContain("[redacted-nvidia-key]");
    expect(redact("Authorization: Bearer abcdefghijklmnop1234")).toBe("Authorization: Bearer [redacted]");
    expect(redact("a".repeat(45))).toBe("[redacted]");
    expect(redact("plain short message")).toBe("plain short message");
  });
});

describe("upstreamMessage", () => {
  it("reads OpenAI-style, Google-style (array) and plain bodies, redacted and capped", () => {
    expect(upstreamMessage({ error: { message: "Model not found" } })).toBe("Model not found");
    expect(upstreamMessage([{ error: { code: 400, message: "API key not valid. Please pass a valid API key." } }])).toContain("API key not valid");
    expect(upstreamMessage({ error: "forced" })).toBe("forced");
    expect(upstreamMessage({ error: { message: "word ".repeat(300) } }).length).toBe(400);
    expect(upstreamMessage(null)).toBeTypeOf("string");
  });
});

describe("classifyHttp: the reason in plain words", () => {
  const kind = (s: number, body: unknown = {}) => classifyHttp(s, body, "Gemini").kind;
  it("maps statuses to a kind", () => {
    expect(kind(400, [{ error: { message: "API key not valid" } }])).toBe("bad_key");
    expect(kind(400, { error: { message: "Unable to process input image" } })).toBe("bad_request");
    expect(kind(401)).toBe("bad_key"); expect(kind(403)).toBe("bad_key");
    expect(kind(404)).toBe("not_found"); expect(kind(410)).toBe("not_found");
    expect(kind(429)).toBe("quota");
    expect(kind(500)).toBe("overloaded"); expect(kind(503)).toBe("overloaded");
    expect(kind(418)).toBe("other");
  });
  it("names the provider, gives a hint, and carries the upstream message", () => {
    const f = classifyHttp(404, { error: { message: "models/old is not found" } }, "NVIDIA");
    expect(f.reason).toContain("NVIDIA"); expect(f.reason).toContain("404");
    expect(f.hint.length).toBeGreaterThan(10);
    expect(f.upstream).toBe("models/old is not found");
  });
});

describe("classifyThrown", () => {
  it("timeouts and network errors", () => {
    expect(classifyThrown(Object.assign(new Error("t"), { name: "TimeoutError" }), 45_000)).toMatchObject({ kind: "timeout" });
    expect(classifyThrown(Object.assign(new Error("t"), { name: "AbortError" }), 45_000).reason).toContain("45 seconds");
    expect(classifyThrown(new TypeError("fetch failed"), 1000)).toMatchObject({ kind: "network", upstream: "fetch failed" });
  });
});

describe("comparisons", () => {
  it("containsCheck ignores case and spacing", () => {
    expect(containsCheck("The  Capital is\nParis.", "capital is paris")).toBe(true);
    expect(containsCheck("London", "paris")).toBe(false);
  });
  it("wordOverlap is the share of expected words found", () => {
    expect(wordOverlap("so um we built the system", "So um we built the system, and uh")).toBeCloseTo(6 / 8);
    expect(wordOverlap("", "a b")).toBe(0);
    expect(wordOverlap("anything", "")).toBe(1);
  });
});
