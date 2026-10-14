import { api, AppError, Errors, ok, requireUser } from "./common.ts";
import { PURPOSES, SLOTS } from "../constants.ts";
import { keysFor, modelFor } from "../env.ts";

export function maskKey(k: string): string {
  return `••••••••${k.slice(-4)}`;
}

export const adminAiKeys = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { deps } = ctx;
  const { data: isAdmin } = await a.userClient.rpc("is_admin");
  if (isAdmin !== true) throw new AppError("forbidden", 403, "You can't do that.");

  const { data: slots } = await deps.admin.from("ai_key_slots").select("id, purpose, slot");
  const idOf = new Map<string, string>((slots ?? []).map((s: any) => [`${s.purpose}:${s.slot}`, s.id]));
  const purposes = PURPOSES.map((purpose) => {
    const configured = new Map(keysFor(deps.env, purpose).map((k) => [k.slot, k.key]));
    return {
      purpose,
      model: purpose === "speech_to_text" ? deps.env.NVIDIA_ASR_MODEL_LABEL : modelFor(deps.env, purpose),
      slots: SLOTS.map((slot) => {
        const k = configured.get(slot);
        return { slot_id: idOf.get(`${purpose}:${slot}`) ?? null, slot, configured: !!k, masked: k ? maskKey(k) : null };
      }),
    };
  });
  return ok({ purposes });
});
export { Errors };
