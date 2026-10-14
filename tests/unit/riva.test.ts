import { afterAll, describe, expect, it } from "vitest";
import { getRivaConfig, recognizePcm, RivaError } from "@shared/riva/client.ts";
import { mergeTranscripts, pcmOf, splitPcm } from "@shared/audio.ts";
import { buildWav } from "@shared/files.ts";
import { startMockRiva } from "../helpers/mock-riva";

const servers: { stop: () => Promise<void> }[] = [];
afterAll(async () => { await Promise.all(servers.map((s) => s.stop())); });

describe("Riva gRPC client (against a local mock using the vendored NVIDIA protos)", () => {
  it("sends the right config + auth metadata and parses word timings", async () => {
    const srv = await startMockRiva(() => [
      { transcript: "Hello, um world.", words: [{ word: "Hello,", start_time: 100, end_time: 400 }, { word: "um", start_time: 500, end_time: 700 }, { word: "world.", start_time: 800, end_time: 1200 }] },
      { transcript: "Second part.", words: [{ word: "Second", start_time: 3000, end_time: 3300 }] },
    ]);
    servers.push(srv);
    const pcm = new Uint8Array(32000); // 1 s
    const t = await recognizePcm(pcm, { target: srv.target, insecure: true, functionId: "fn-123", apiKey: "nvapi-test" });
    expect(t.text).toBe("Hello, um world. Second part.");
    expect(t.words).toEqual([
      { w: "Hello,", start_ms: 100, end_ms: 400 }, { w: "um", start_ms: 500, end_ms: 700 }, { w: "world.", start_ms: 800, end_ms: 1200 }, { w: "Second", start_ms: 3000, end_ms: 3300 },
    ]);
    const call = srv.calls[0]!;
    expect(call.metadata["function-id"]).toBe("fn-123");
    expect(call.metadata["authorization"]).toBe("Bearer nvapi-test");
    expect(call.audioBytes).toBe(32000);
    expect(call.config).toMatchObject({ encoding: "LINEAR_PCM", sample_rate_hertz: 16000, language_code: "en-US", enable_word_time_offsets: true, enable_automatic_punctuation: true, audio_channel_count: 1 });
  });
  it("config probe lists served models using the same auth metadata", async () => {
    const srv = await startMockRiva(() => []); servers.push(srv);
    const models = await getRivaConfig({ target: srv.target, insecure: true, functionId: "fn-9", apiKey: "k" });
    expect(models).toEqual(["parakeet-tdt-0.6b-v2-en-US-asr-offline"]);
    expect(srv.calls.at(-1)!.metadata).toMatchObject({ "function-id": "fn-9", authorization: "Bearer k" });
  });
  it("silence -> empty transcript, not an error", async () => {
    const srv = await startMockRiva(() => []); servers.push(srv);
    const t = await recognizePcm(new Uint8Array(3200), { target: srv.target, insecure: true });
    expect(t).toEqual({ text: "", words: [] });
  });
  it("maps gRPC failures to HTTP-like statuses for the key router", async () => {
    for (const [code, http] of [[8, 429], [16, 401], [7, 403], [3, 400], [14, 503]] as const) {
      const srv = await startMockRiva(() => ({ code, message: "x" })); servers.push(srv);
      const err = await recognizePcm(new Uint8Array(3200), { target: srv.target, insecure: true }).catch((e) => e);
      expect(err).toBeInstanceOf(RivaError);
      expect(err.httpStatus).toBe(http);
    }
  });
  it("times out", async () => {
    const srv = await startMockRiva(() => { const t = Date.now(); while (Date.now() - t < 600); return []; }); servers.push(srv);
    const err = await recognizePcm(new Uint8Array(3200), { target: srv.target, insecure: true, timeoutMs: 100 }).catch((e) => e);
    expect(err.httpStatus).toBe(504);
  });
});

describe("chunking + merge", () => {
  it("splits at sample boundaries with offsets and reassembles word timings", () => {
    const pcm = new Uint8Array(32 * 150_000); // 150 s
    const chunks = splitPcm(pcm, 60_000);
    expect(chunks.map((c) => c.offsetMs)).toEqual([0, 60000, 120000]);
    expect(chunks.map((c) => c.pcm.length)).toEqual([1_920_000, 1_920_000, 960_000]);
    expect(chunks.every((c) => c.pcm.length % 2 === 0)).toBe(true);
    const merged = mergeTranscripts([
      { offsetMs: 60000, t: { text: "two", words: [{ w: "two", start_ms: 10, end_ms: 20 }] } },
      { offsetMs: 0, t: { text: "one", words: [{ w: "one", start_ms: 10, end_ms: 20 }] } },
      { offsetMs: 120000, t: { text: "", words: [] } },
    ]);
    expect(merged.text).toBe("one two");
    expect(merged.words.map((w) => w.start_ms)).toEqual([10, 60010]);
  });
  it("short audio stays one chunk; pcmOf strips the header", () => {
    expect(splitPcm(new Uint8Array(100), 60000)).toHaveLength(1);
    const wav = buildWav(new Uint8Array([1, 2, 3, 4]));
    expect(Array.from(pcmOf(wav))).toEqual([1, 2, 3, 4]);
    expect(() => pcmOf(new Uint8Array(100))).toThrow(/invalid_wav/);
  });
});
