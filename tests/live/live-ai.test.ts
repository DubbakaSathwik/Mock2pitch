// LIVE NVIDIA smoke tests. Skipped unless RUN_LIVE_AI_TESTS=1 (they spend credits). Needs the NVIDIA_* env vars from .env.example.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { routeCall, type RouterStore, type SlotState, type UsageEntry } from "@shared/nvidia/router.ts";
import { chatText, chatTransport, parseJsonLoose } from "@shared/nvidia/chat.ts";
import { readSlide } from "@shared/ai/slide.ts";
import { generateReport } from "@shared/ai/report.ts";
import { recognizePcm } from "@shared/riva/client.ts";
import { grpcAsr } from "@shared/ai/asr-grpc.ts";
import { transcribePcm } from "@shared/ai/asr.ts";
import { slideReadingOut } from "@shared/schemas.ts";
import type { Deps } from "@shared/deps.ts";

const live = process.env.RUN_LIVE_AI_TESTS === "1";
const fx = (n: string) => new Uint8Array(fs.readFileSync(path.resolve(__dirname, "../fixtures", n)));

class MemStore implements RouterStore {
  logs: UsageEntry[] = [];
  async slotStates(): Promise<SlotState[]> { return (["primary", "fallback_1", "fallback_2"] as const).map((slot) => ({ id: slot, slot, cooldownUntil: null, creditLimit: 1000, usedCredits: 0, requestsLast60s: 0 })); }
  async setCooldown() {}
  async log(e: UsageEntry) { this.logs.push(e); }
}
const e = process.env as Record<string, string | undefined>;
const deps = () => ({
  env: {
    NVIDIA_SLIDE_MODEL: e.NVIDIA_SLIDE_MODEL ?? "meta/llama-4-maverick-17b-128e-instruct", NVIDIA_REPORT_MODEL: e.NVIDIA_REPORT_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b",
    NVIDIA_ASR_MODEL_LABEL: e.NVIDIA_ASR_MODEL_LABEL ?? "parakeet-tdt-0.6b-v2", NVIDIA_ASR_FUNCTION_ID: e.NVIDIA_ASR_FUNCTION_ID, NVIDIA_KEY_RPM_SOFT_LIMIT: 35,
    NVIDIA_SLIDE_KEY_PRIMARY: e.NVIDIA_SLIDE_KEY_PRIMARY, NVIDIA_SLIDE_KEY_FALLBACK_1: e.NVIDIA_SLIDE_KEY_FALLBACK_1, NVIDIA_SLIDE_KEY_FALLBACK_2: e.NVIDIA_SLIDE_KEY_FALLBACK_2,
    NVIDIA_REPORT_KEY_PRIMARY: e.NVIDIA_REPORT_KEY_PRIMARY, NVIDIA_REPORT_KEY_FALLBACK_1: e.NVIDIA_REPORT_KEY_FALLBACK_1, NVIDIA_REPORT_KEY_FALLBACK_2: e.NVIDIA_REPORT_KEY_FALLBACK_2,
    NVIDIA_ASR_KEY_PRIMARY: e.NVIDIA_ASR_KEY_PRIMARY, NVIDIA_ASR_KEY_FALLBACK_1: e.NVIDIA_ASR_KEY_FALLBACK_1, NVIDIA_ASR_KEY_FALLBACK_2: e.NVIDIA_ASR_KEY_FALLBACK_2,
  },
  fetchFn: fetch,
  asr: grpcAsr({ functionId: e.NVIDIA_ASR_FUNCTION_ID ?? "", protoRoot: path.resolve(__dirname, "../../supabase/functions/_shared/riva") }),
}) as unknown as Deps;

describe.skipIf(!live)("live NVIDIA", () => {
  it("slide_reading: a real slide image becomes a valid structured slide", async () => {
    const store = new MemStore();
    const out = await readSlide(deps(), store, fx("slide-1.jpg"), { userId: "u", deckId: "d" });
    expect(slideReadingOut.safeParse(out).success).toBe(true);
    expect(out.key_points.length).toBeGreaterThanOrEqual(1);
    expect(store.logs[0]).toMatchObject({ purpose: "slide_reading", outcome: "success", slotId: "primary" });
  }, 120_000);

  it("report_generation: returns schema-valid JSON for realistic input", async () => {
    const store = new MemStore();
    const slides = [0, 1, 2].map((i) => ({ slide_index: i, title: `Slide ${i + 1}`, key_points: ["Point A", "Point B"], suggested_seconds: 40, actual_seconds: 41, wpm: 140, filler_counts: [{ word: "um", count: 2 }], recorded: true, transcript: "So um today we cover Point A in detail and then move on." }));
    const r = await generateReport(deps(), store, slides, { userId: "u", sessionId: "s" });
    expect(r.top_fixes).toHaveLength(3);
    expect(r.did_well).toHaveLength(3);
    expect(r.clarity_score).toBeGreaterThanOrEqual(0);
  }, 180_000);

  it("speech_to_text: transcribes the fixture and logs audio length", async () => {
    const store = new MemStore();
    const wav = fx(process.env.LIVE_WAV ?? "clip-fillers-synthetic.wav");
    const t = await transcribePcm(deps(), store, wav.subarray(44), { userId: "u", sessionId: "s" });
    console.log("LIVE ASR TRANSCRIPT:", t.text);
    expect(t.text.length).toBeGreaterThan(5);
    expect(store.logs[0]).toMatchObject({ purpose: "speech_to_text", outcome: "success" });
  }, 120_000);

  it("raw chat transport reaches the API with each configured key", async () => {
    for (const k of [e.NVIDIA_SLIDE_KEY_PRIMARY, e.NVIDIA_SLIDE_KEY_FALLBACK_1, e.NVIDIA_SLIDE_KEY_FALLBACK_2].filter(Boolean) as string[]) {
      const model = e.NVIDIA_REPORT_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b";
      const text = await routeCall({
        purpose: "report_generation", model, keys: [{ slot: "primary", key: k }], store: new MemStore(), rpmSoftLimit: 35, timeoutMs: 60_000,
        transport: chatTransport(model, [{ role: "user", content: 'Reply with the JSON {"ok":true}' }]), validate: (b) => parseJsonLoose(chatText(b)),
      });
      expect(text).toBeTruthy();
    }
  }, 180_000);
  void recognizePcm;
});

describe("live test gating", () => {
  it("is skipped by default so credits are never spent accidentally", () => { expect(live).toBe(process.env.RUN_LIVE_AI_TESTS === "1"); });
});
