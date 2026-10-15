// Phase 4 hardening: rejected audio no longer leaves the session in `uploading_audio` (which blocks the student's next analysis).
// Student A on the deck from specs 02/07: invalid clip → session back to in_progress at once → re-submit a valid clip → the analysis starts
// and completes. Cost: 1 complete analysis (ASR on a 5.6 s clip + 1 report).
import { expect, test } from "@playwright/test";
import { fixtureBytes, putSigned, userApi } from "./support/api";

test("rejected audio gives the slot back; the same session can be re-submitted and analysed", async () => {
  test.setTimeout(300_000);
  const api = await userApi("A");
  const { data: decks } = await api.client.from("decks").select("id").eq("status", "ready").order("created_at", { ascending: false }).limit(1);
  expect(decks?.length, "student A needs a ready deck (run spec 02/07 first)").toBe(1);
  const deckId = decks![0]!.id as string;
  const { data: open } = await api.client.from("practice_sessions").select("id").eq("deck_id", deckId).in("status", ["in_progress", "uploading_audio"]).limit(1);
  let sessionId = open?.[0]?.id as string | undefined;
  if (!sessionId) {
    const start = await api.client.rpc("start_practice_session", { p_deck_id: deckId, p_total_minutes: 5 });
    expect(start.error, JSON.stringify(start.error)).toBeNull();
    sessionId = (start.data as { id: string }).id;
  }
  const status = async () => (await api.client.from("practice_sessions").select("status").eq("id", sessionId!).single()).data!.status as string;

  const bad = fixtureBytes("clip-invalid-stereo.wav");
  const i1 = await api.fn("session-submit-init", { session_id: sessionId, clips: [{ slide_index: 0, size_bytes: bad.length }] });
  expect(i1.ok, JSON.stringify(i1.error)).toBe(true);
  expect(await status()).toBe("uploading_audio");
  expect((await putSigned(i1.data!.clips[0].upload, bad)).status).toBeLessThan(300);
  const a1 = await api.fn("session-analyse", { session_id: sessionId });
  expect([a1.status, a1.error?.code]).toEqual([400, "audio_invalid"]);
  expect(await status()).toBe("in_progress"); // the analysing slot is free again

  const good = fixtureBytes("clip-fillers-synthetic.wav");
  const i2 = await api.fn("session-submit-init", { session_id: sessionId, clips: [{ slide_index: 0, size_bytes: good.length }] });
  expect(i2.ok, JSON.stringify(i2.error)).toBe(true);
  expect((await putSigned(i2.data!.clips[0].upload, good)).status).toBeLessThan(300);
  const a2 = await api.fn("session-analyse", { session_id: sessionId });
  expect([a2.status, a2.ok]).toEqual([202, true]);
  await expect.poll(status, { timeout: 180_000, intervals: [2_000] }).toMatch(/completed|failed/);
  expect(await status(), "analysis should complete (a 503 on the report model would show as failed — re-run once)").toBe("completed");
});
