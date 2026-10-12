import { api, AppError, Errors, isInternal, logEvent, ok, readBody, requireUser } from "./common.ts";
import { deckIdIn, BLANK_SLIDE, type SlideReadingOut } from "../schemas.ts";
import { SLIDE_CONCURRENCY, SLIDE_IMAGE_MAX_BYTES } from "../constants.ts";
import { isJpegSignature } from "../files.ts";
import { keys } from "../r2.ts";
import { supabaseRouterStore } from "../ai/store.ts";
import { readSlide } from "../ai/slide.ts";
import type { Ctx, Deps } from "../deps.ts";

const FRESH_MS = 2 * 60 * 1000; // a user re-call within this window of the last heartbeat is a no-op

export const deckProcess = api(async (ctx) => {
  const internal = isInternal(ctx.req, ctx.deps);
  const { deps } = ctx;
  const userId = internal ? null : (await requireUser(ctx)).userId;
  const { deck_id } = await readBody(ctx.req, deckIdIn);

  let q = deps.admin.from("decks").select("id, owner_id, status, page_count, error_code, updated_at").eq("id", deck_id);
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
    if (!["ai_unavailable", "processing_failed"].includes(deck.error_code)) throw Errors.conflict("invalid_state");
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

  // The unique "one active deck per owner" index can reject re-activating a failed deck.
  const { error } = await deps.admin.from("decks").update({ status: "processing", error_code: null, processing_stage: `Reading slide 1 of ${n}` }).eq("id", deck_id);
  if (error) throw error.code === "23505" ? Errors.conflict("deck_in_progress", "Finish your current deck first.") : new AppError("internal", 500, "Something went wrong.");

  deps.background(runDeckProcessing(deps, deck_id, owner, n).catch((e) => failDeckProcessing(deps, deck_id, e)));
  return ok({ deck_id, status: "processing" }, ctx.cors, 202);
});

async function failDeckProcessing(deps: Deps, deckId: string, e: unknown) {
  const code = (e as { code?: string })?.code === "AI_BUSY" ? "ai_unavailable" : "processing_failed";
  logEvent("deck_processing_failed", { deck_id: deckId, code });
  await deps.admin.from("decks").update({ status: "failed", error_code: code, processing_stage: null }).eq("id", deckId);
}

/** Idempotent + resumable: slides already stored are skipped; rows are upserted per (deck, slide_index). */
export async function runDeckProcessing(deps: Deps, deckId: string, owner: string, n: number): Promise<void> {
  const store = supabaseRouterStore(deps.admin);
  const { data: done } = await deps.admin.from("slides").select("slide_index").eq("deck_id", deckId);
  const have = new Set<number>((done ?? []).map((r: any) => r.slide_index));
  const todo = Array.from({ length: n }, (_, i) => i).filter((i) => !have.has(i));
  let processed = have.size;
  let fatal: unknown = null;

  const queue = [...todo];
  const worker = async () => {
    while (queue.length && !fatal) {
      const i = queue.shift()!;
      try {
        const { data: file } = await deps.admin.from("files").select("id, object_key").eq("deck_id", deckId).eq("kind", "slide_image").eq("slide_index", i).eq("status", "uploaded").maybeSingle();
        if (!file) throw new Error("image_missing");
        const jpeg = await deps.r2.get(file.object_key);
        const out = await readOneSlide(deps, store, jpeg, owner, deckId);
        const { error } = await deps.admin.from("slides").upsert({
          deck_id: deckId, slide_index: i, title: out.title, extracted_text: out.slide_text, key_points: out.key_points,
          suggested_script: out.suggested_script, time_weight: out.time_weight, image_file_id: file.id,
        }, { onConflict: "deck_id,slide_index" });
        if (error) throw new Error("slide_write_failed");
        processed++;
        await deps.admin.from("decks").update({ processed_slides: processed, processing_stage: `Reading slide ${Math.min(processed + 1, n)} of ${n}` }).eq("id", deckId);
      } catch (e) {
        fatal = e; // AI_BUSY or infrastructure error: stop all workers
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SLIDE_CONCURRENCY, todo.length) }, worker));
  if (fatal) throw fatal;
  await deps.admin.from("decks").update({ status: "ready", processed_slides: n, processing_stage: null, error_code: null }).eq("id", deckId);
}

/** One slide: invalid output is retried once, then (like an unreadable image) falls back to a generic row. AI_BUSY propagates. */
async function readOneSlide(deps: Deps, store: ReturnType<typeof supabaseRouterStore>, jpeg: Uint8Array, userId: string, deckId: string): Promise<SlideReadingOut> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await readSlide(deps, store, jpeg, { userId, deckId });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "AI_BUSY") throw e;
      if (code === "bad_request") break; // the image itself is the problem: retrying won't help
      if (code !== "invalid_output") throw e;
    }
  }
  return { ...BLANK_SLIDE };
}
