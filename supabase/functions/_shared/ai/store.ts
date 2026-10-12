// RouterStore backed by Supabase (service role): key-slot state in one RPC, cooldowns, and the usage log.
import type { Sb } from "../deps.ts";
import type { RouterStore, SlotState, UsageEntry } from "../nvidia/router.ts";
import type { Purpose, Slot } from "../constants.ts";

export function supabaseRouterStore(admin: Sb): RouterStore {
  return {
    async slotStates(purpose: Purpose): Promise<SlotState[]> {
      const { data, error } = await admin.rpc("svc_ai_slot_states", { p_purpose: purpose });
      if (error) throw new Error("slot_states_failed");
      return (data as any[]).map((r) => ({
        id: r.id, slot: r.slot as Slot, cooldownUntil: r.cooldown_until ? new Date(r.cooldown_until) : null,
        creditLimit: r.credit_limit, usedCredits: r.used_credits, requestsLast60s: r.requests_last_60s,
      }));
    },
    async setCooldown(slotId, until, errorCode) {
      await admin.from("ai_key_slots").update({ cooldown_until: until.toISOString(), last_error_code: errorCode }).eq("id", slotId);
    },
    async log(e: UsageEntry) {
      // Never prompt text, transcripts or keys.
      await admin.from("ai_usage_log").insert({
        purpose: e.purpose, key_slot_id: e.slotId, model: e.model, user_id: e.userId ?? null, deck_id: e.deckId ?? null, session_id: e.sessionId ?? null,
        outcome: e.outcome, http_status: e.httpStatus, latency_ms: e.latencyMs, prompt_tokens: e.promptTokens ?? null,
        completion_tokens: e.completionTokens ?? null, audio_ms: e.audioMs ?? null,
      });
    },
  };
}
