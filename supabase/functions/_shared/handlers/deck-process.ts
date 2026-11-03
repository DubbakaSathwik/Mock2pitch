import { api, AppError, Errors, isInternal, logEvent, ok, readBody, requireUser } from "./common.ts";
import { deckProcessIn } from "../schemas.ts";
import { SLIDE_IMAGE_MAX_BYTES, type Audience } from "../constants.ts";
import { isJpegSignature } from "../files.ts";
import { supabaseRouterStore } from "../ai/store.ts";
import { DEFAULT_TOTAL_MINUTES, readSlides, type SlideImage } from "../ai/deck.ts";
import type { DeckPromptDetails } from "../prompts/deck-reading.ts";
import type { Deps } from "../deps.ts";

const FRESH_MS = 2 * 60 * 1000; // a user re-call within this window of the last heartbeat is a no-op

export const deckProcess = api(async (ctx) => {
  const internal = isInternal(ctx.req, ctx.deps);
  const { deps } = ctx;
  const userId = internal ? null : (await requireUser(ctx)).userId;
  const { deck_id, details } = await readBody(ctx.req, deckProcessIn);

  let q = deps.admin.from("decks").select("id, owner_id, status, page_count, error_code, updated_at, audience, audience_other, goal, abstract, target_minutes").eq("id", deck_id);
  if (userId) q = q.eq("owner_id", userId);
  const { data: deck } = await q.maybeSingle();
  if (!deck) throw Errors.notFound();
  const owner = deck.owner_id as string;

  if (deck.status === "ready") return ok({ deck_id, status: "ready" });
  if (deck.status === "processing") {
    const age = deps.now().getTime() - new Date(deck.updated_at).getTime();
    if (!internal && age < FRESH_MS) return ok({ deck_id, status: "processing" }, ctx.cors, 202);
    // else: stale (worker died) => resume below
  } else if (deck.status === "failed") {
    if (!["ai_unavailable", "processing_failed", "misconfigured"].includes(deck.error_code)) throw Errors.conflict("invalid_state");
  } else if (deck.status !== "awaiting_images") {
    throw Errors.conflict("invalid_state");
  }

  // ---- verify every slide image (exists, size, JPEG signature) ----
  const n = deck.page_count as number;
  const { data: rows } = await deps.admin.from("files").select("id, slide_index, object_key, status").eq("deck_id", deck_id).eq("kind", "slide_image").in("status", ["pending", "uploaded"]);
  const byIdx = new Map<number, { id: string; object_key: string }>((rows ?? []).map((r: any) => [r.slide_index, r]));
  const missing: number[] = [];
  for (let i = 0; i < n; i++) {
    const row = byIdx.get(i);
    const head = row ? await deps.r2.head(row.object_key) : null;
    if (!row || !head) { missing.push(i); continue; }
    if (head.size <= 0 || head.size > SLIDE_IMAGE_MAX_BYTES) {
      await deps.r2.delete(row.object_key).catch(() => {}); // row stays 'pending' so the slot can be re-uploaded
      throw Errors.badRequest("image_too_large", `Slide ${i + 1}'s image is too large.`, { slide_index: i });
    }
    const first = await deps.r2.getRange(row.object_key, 0, 7);
    if (!isJpegSignature(first)) {
      await deps.r2.delete(row.object_key).catch(() => {});
      throw Errors.badRequest("not_jpeg", `Slide ${i + 1}'s image isn't a JPEG.`, { slide_index: i });
    }
    await deps.admin.from("files").update({ status: "uploaded", size_bytes: head.size, uploaded_at: deps.now().toISOString() }).eq("id", row.id);
  }
  if (missing.length) throw Errors.badRequest("images_missing", "Some slide images didn't upload.", { missing });

  // The Details step sends its answers with the FIRST start only (status awaiting_images); a retry after a failure, or a sweeper resume,
  // reuses what is stored on the deck (decks created before the Details step have none: a neutral prompt and the default time).
  const fresh = deck.status === "awaiting_images" ? details : undefined;
  const detailCols = fresh
    ? { audience: fresh.audience, audience_other: fresh.audience_other ?? null, goal: fresh.goal ?? null, abstract: fresh.abstract ?? null, target_minutes: fresh.total_minutes }
    : {};
  const effective: DeckPromptDetails = fresh
    ? { audience: fresh.audience as Audience, audience_other: fresh.audience_other, goal: fresh.goal, abstract: fresh.abstract, total_minutes: fresh.total_minutes }
    : { audience: (deck.audience ?? undefined) as Audience | undefined, audience_other: deck.audience_other ?? undefined, goal: deck.goal ?? undefined, abstract: deck.abstract ?? undefined, total_minutes: deck.target_minutes ?? DEFAULT_TOTAL_MINUTES };
  // The unique "one active deck per owner" index can reject re-activating a failed deck.
  const { error } = await deps.admin.from("decks").update({ ...detailCols, status: "processing", error_code: null, processing_stage: `Reading your ${n} slide${n === 1 ? "" : "s"}` }).eq("id", deck_id);
  if (error) throw error.code === "23505" ? Errors.conflict("deck_in_progress", "Finish your current deck first.") : new AppError("internal", 500, "Something went wrong.");

  deps.background(runDeckProcessing(deps, deck_id, owner, n, effective).catch((e) => failDeckProcessing(deps, deck_id, e)));
  return ok({ deck_id, status: "processing" }, ctx.cors, 202);
});

async function failDeckProcessing(deps: Deps, deckId: string, e: unknown) {
  // model_unavailable = the configured Gemini model was retired/renamed: an owner problem, not "busy" (the UI says so and still offers Try again once it is fixed)
  const c = (e as { code?: string })?.code;
  const code = c === "AI_BUSY" ? "ai_unavailable" : c === "model_unavailable" ? "misconfigured" : "processing_failed";
  logEvent("deck_processing_failed", { deck_id: deckId, code });
  await deps.admin.from("decks").update({ status: "failed", error_code: code, processing_stage: null }).eq("id", deckId);
}

/**
 * Idempotent + resumable: slides already stored are skipped; rows are upserted per (deck, slide_index).
 * One Gemini request reads every slide still to do (with the student's details) and the rows are written together; only unusable
 * output splits the work into smaller requests (see ai/deck.ts). AI_BUSY / model_unavailable propagate and fail the deck.
 */
export async function runDeckProcessing(deps: Deps, deckId: string, owner: string, n: number, details: DeckPromptDetails = { total_minutes: DEFAULT_TOTAL_MINUTES }): Promise<void> {
  const store = supabaseRouterStore(deps.admin);
  const { data: done } = await deps.admin.from("slides").select("slide_index").eq("deck_id", deckId);
  const have = new Set<number>((done ?? []).map((r: any) => r.slide_index));
  const todo = Array.from({ length: n }, (_, i) => i).filter((i) => !have.has(i));

  if (todo.length) {
    const { data: files } = await deps.admin.from("files").select("id, slide_index, object_key").eq("deck_id", deckId).eq("kind", "slide_image").eq("status", "uploaded");
    const fileBy = new Map<number, { id: string; object_key: string }>((files ?? []).map((f: any) => [f.slide_index, f]));
    const images: SlideImage[] = [];
    for (const i of todo) {
      const f = fileBy.get(i);
      if (!f) throw new Error("image_missing");
      images.push({ index: i, jpeg: await deps.r2.get(f.object_key) });
    }
    const read = await readSlides(deps, store, images, details, n, { userId: owner, deckId });
    const rows = todo.map((i) => {
      const r = read.get(i);
      if (!r) throw new Error("slide_missing");
      return { deck_id: deckId, slide_index: i, title: r.title, extracted_text: r.slide_text, key_points: r.key_points, suggested_script: r.script, time_weight: r.weight, image_file_id: fileBy.get(i)!.id };
    });
    const { error } = await deps.admin.from("slides").upsert(rows, { onConflict: "deck_id,slide_index" });
    if (error) throw new Error("slide_write_failed");
  }
  await deps.admin.from("decks").update({ status: "ready", processed_slides: n, processing_stage: null, error_code: null }).eq("id", deckId);
}
