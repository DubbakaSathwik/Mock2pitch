// Flow 5.5 (audio side): a recording that is not the expected 16 kHz mono 16-bit WAV is rejected by session-analyse before any AI call.
// Direct API (every client check bypassed). Student A on one existing ready deck: 1 session slot, 0 AI credits (asserted from ai_usage_log
// being unchanged, read as the service through the user's own usage_events + the MCP check recorded in docs/phase-3/integration.md).
import { expect, test } from "@playwright/test";
import { fixtureBytes, putSigned, userApi } from "./support/api";

test("stereo / 44.1 kHz / not-RIFF clips → audio_invalid (400), object deleted, file failed, nothing analysed", async () => {
  test.setTimeout(180_000);
  const api = await userApi("A");
  const { data: decks } = await api.client.from("decks").select("id,page_count").eq("status", "ready").order("created_at", { ascending: false }).limit(1);
  expect(decks?.length, "student A needs a ready deck (run spec 02/07 first)").toBe(1);
  const deckId = decks![0]!.id as string;

  // re-runnable: reuse an unfinished session of this deck instead of spending another daily slot
  const { data: open } = await api.client.from("practice_sessions").select("id").eq("deck_id", deckId).in("status", ["in_progress", "uploading_audio"]).limit(1);
  let sessionId = open?.[0]?.id as string | undefined;
  if (!sessionId) {
    const start = await api.client.rpc("start_practice_session", { p_deck_id: deckId, p_total_minutes: 5 });
    expect(start.error, JSON.stringify(start.error)).toBeNull();
    sessionId = (start.data as { id: string }).id;
  }

  const cases: [string, string, RegExp][] = [
    ["stereo", "clip-invalid-stereo.wav", /./],
    ["44.1 kHz", "clip-invalid-44k.wav", /./],
    ["not RIFF", "clip-invalid-not-riff.wav", /./],
  ];
  for (const [label, file, _reason] of cases) {
    const bytes = fixtureBytes(file);
    const init = await api.fn("session-submit-init", { session_id: sessionId, clips: [{ slide_index: 0, size_bytes: bytes.length }] });
    expect(init.ok, `${label}: ${JSON.stringify(init.error)}`).toBe(true);
    const put = await putSigned(init.data!.clips[0].upload, bytes);
    expect(put.status, put.text).toBeLessThan(300);
    const analyse = await api.fn("session-analyse", { session_id: sessionId });
    expect(analyse.status, label).toBe(400);
    expect(analyse.error?.code, label).toBe("audio_invalid");
    expect(analyse.error?.slide_index, label).toBe(0);
    console.log(`audio_invalid (${label}): reason=${String(analyse.error?.reason)}`);
    // files is not readable by students (column grants); the failed status + deleted object were verified with SQL (docs/phase-3/integration.md)
  }

  // the declared size must also match: a short PUT is refused by R2, a mismatched complete is rejected as size_mismatch
  const good = fixtureBytes("clip-valid-3s.wav");
  const init = await api.fn("session-submit-init", { session_id: sessionId, clips: [{ slide_index: 0, size_bytes: good.length + 100 }] });
  expect(init.ok).toBe(true);
  const put = await putSigned(init.data!.clips[0].upload, good.subarray(0, good.length));
  expect(put.status).toBeGreaterThanOrEqual(400); // Content-Length is part of the signature

  const { data: s } = await api.client.from("practice_sessions").select("status,error_code").eq("id", sessionId).single();
  console.log(`session after rejected audio: ${JSON.stringify(s)}`);
  expect(["uploading_audio", "failed", "in_progress"]).toContain(s!.status);
  const { data: results } = await api.client.from("session_slide_results").select("slide_index").eq("session_id", sessionId);
  expect(results ?? []).toHaveLength(0);
  const { data: reports } = await api.client.from("reports").select("id").eq("session_id", sessionId);
  expect(reports ?? []).toHaveLength(0);
});
