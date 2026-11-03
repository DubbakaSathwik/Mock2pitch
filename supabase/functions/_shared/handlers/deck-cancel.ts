import { api, Errors, logEvent, ok, readBody, requireUser } from "./common.ts";
import { deckIdIn } from "../schemas.ts";

/** Decks that count as "in flight" (the unique index decks_one_active_per_owner covers exactly these). */
export const ACTIVE_DECK_STATUSES = ["awaiting_upload", "uploaded", "awaiting_images", "processing"] as const;

/**
 * Cancels the caller's unfinished deck so a new one can be uploaded: marks it failed/`cancelled`, discards its PDF, slide images and any
 * slides already read. The daily session it used is NOT given back. Safe to call twice. A reading that is still running in the background
 * notices the new status and stops (deck-process only writes while the deck is still `processing`).
 */
export const deckCancel = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { deck_id } = await readBody(ctx.req, deckIdIn);
  const { deps } = ctx;

  const { data: deck } = await deps.admin.from("decks").select("id, status, error_code").eq("id", deck_id).eq("owner_id", a.userId).maybeSingle();
  if (!deck) throw Errors.notFound();
  if (deck.status === "failed" && deck.error_code === "cancelled") return ok({ deck_id, status: "cancelled" }); // already done
  if (!(ACTIVE_DECK_STATUSES as readonly string[]).includes(deck.status)) throw Errors.conflict("invalid_state"); // ready / failed for another reason: nothing to cancel

  // Flip the status first (and only while it is still active) so a worker that is mid-way stops writing.
  const { data: flipped } = await deps.admin.from("decks")
    .update({ status: "failed", error_code: "cancelled", processing_stage: null })
    .eq("id", deck_id).in("status", ACTIVE_DECK_STATUSES as unknown as string[]).select("id");
  if (!flipped || flipped.length === 0) { // lost a race: the deck finished or was cancelled in the meantime
    const { data: now } = await deps.admin.from("decks").select("status, error_code").eq("id", deck_id).maybeSingle();
    if (now?.status === "failed" && now.error_code === "cancelled") return ok({ deck_id, status: "cancelled" });
    throw Errors.conflict("invalid_state");
  }

  const { data: files } = await deps.admin.from("files").select("id, object_key").eq("deck_id", deck_id).in("kind", ["deck_pdf", "slide_image"]).neq("status", "deleted");
  for (const f of (files ?? []) as { id: string; object_key: string }[]) {
    try { await deps.r2.delete(f.object_key); } catch { continue; } // the sweeper's pending-file cleanup retries what could not be removed now
    await deps.admin.from("files").update({ status: "deleted", deleted_at: deps.now().toISOString() }).eq("id", f.id);
  }
  await deps.admin.from("slides").delete().eq("deck_id", deck_id);
  logEvent("deck_cancelled", { deck_id });
  return ok({ deck_id, status: "cancelled" });
});
