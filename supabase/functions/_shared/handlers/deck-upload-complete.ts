import { PDFDocument } from "pdf-lib";
import { api, AppError, Errors, fromDbError, ok, readBody, requireUser } from "./common.ts";
import { deckIdIn } from "../schemas.ts";
import { MAX_PDF_BYTES, MAX_SLIDES, PUT_EXPIRES_S, SLIDE_IMAGE_JPEG_QUALITY, SLIDE_IMAGE_MAX_BYTES, SLIDE_IMAGE_MAX_WIDTH } from "../constants.ts";
import { isPdfSignature } from "../files.ts";
import { keys } from "../r2.ts";
import type { Ctx } from "../deps.ts";

const RULES = { max_width: SLIDE_IMAGE_MAX_WIDTH, jpeg_quality: SLIDE_IMAGE_JPEG_QUALITY, max_bytes: SLIDE_IMAGE_MAX_BYTES, content_type: "image/jpeg" };

async function failDeck(ctx: Ctx, userId: string, deckId: string, code: string) {
  await ctx.deps.r2.delete(keys.deckPdf(userId, deckId)).catch(() => {});
  await ctx.deps.admin.from("files").update({ status: "deleted", deleted_at: ctx.deps.now().toISOString() }).eq("deck_id", deckId).eq("kind", "deck_pdf");
  await ctx.deps.admin.from("decks").update({ status: "failed", error_code: code, processing_stage: null }).eq("id", deckId);
}

async function imageUrls(ctx: Ctx, userId: string, deckId: string, pageCount: number) {
  const images = [];
  for (let i = 0; i < pageCount; i++) {
    images.push({ slide_index: i, upload: await ctx.deps.r2.presignPut(keys.slideImage(userId, deckId, i), { contentType: "image/jpeg", expiresS: PUT_EXPIRES_S }) });
  }
  return images;
}

export const deckUploadComplete = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { deck_id } = await readBody(ctx.req, deckIdIn);
  const { deps } = ctx;

  const { data: deck } = await deps.admin.from("decks").select("id, owner_id, status, page_count").eq("id", deck_id).eq("owner_id", a.userId).maybeSingle();
  if (!deck) throw Errors.notFound();

  // Idempotent re-call after success: hand the image URLs out again.
  if (deck.status === "awaiting_images") return ok({ deck_id, page_count: deck.page_count, images: await imageUrls(ctx, a.userId, deck_id, deck.page_count), rules: RULES });
  if (deck.status !== "awaiting_upload") throw Errors.conflict("invalid_state");

  const { data: file } = await deps.admin.from("files").select("expected_size_bytes").eq("deck_id", deck_id).eq("kind", "deck_pdf").eq("status", "pending").maybeSingle();
  if (!file) throw Errors.conflict("invalid_state");

  const key = keys.deckPdf(a.userId, deck_id);
  const head = await deps.r2.head(key);
  if (!head) throw Errors.badRequest("upload_missing", "We didn't receive your file. Please try again.");
  if (head.size > MAX_PDF_BYTES) { await failDeck(ctx, a.userId, deck_id, "too_large"); throw Errors.tooLarge("too_large"); }
  if (head.size !== Number(file.expected_size_bytes)) { await failDeck(ctx, a.userId, deck_id, "size_mismatch"); throw Errors.badRequest("size_mismatch", "The uploaded file didn't match."); }

  const first = await deps.r2.getRange(key, 0, 7);
  if (!isPdfSignature(first)) { await failDeck(ctx, a.userId, deck_id, "not_pdf"); throw Errors.badRequest("not_pdf", "That doesn't look like a PDF."); }

  let pages: number;
  try {
    const bytes = await deps.r2.get(key);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: false });
    pages = pdf.getPageCount();
  } catch (e) {
    const encrypted = /encrypt/i.test((e as Error)?.name + " " + (e as Error)?.message);
    const code = encrypted ? "encrypted_pdf" : "corrupt_pdf";
    await failDeck(ctx, a.userId, deck_id, code);
    throw Errors.badRequest(code, encrypted ? "That PDF is password-protected." : "We couldn't read that PDF.");
  }
  if (pages < 1) { await failDeck(ctx, a.userId, deck_id, "corrupt_pdf"); throw Errors.badRequest("corrupt_pdf", "We couldn't read that PDF."); }
  if (pages > MAX_SLIDES) {
    await failDeck(ctx, a.userId, deck_id, "too_many_pages"); // nothing consumed
    throw Errors.badRequest("too_many_pages", `That deck has ${pages} slides. The limit is ${MAX_SLIDES}.`, { page_count: pages, max_pages: MAX_SLIDES });
  }

  const imgRows = Array.from({ length: pages }, (_, i) => ({ slide_index: i, bucket: deps.r2.bucket, object_key: keys.slideImage(a.userId, deck_id, i), expected_size_bytes: SLIDE_IMAGE_MAX_BYTES }));
  const { error } = await deps.admin.rpc("svc_complete_deck_upload", { p_deck_id: deck_id, p_page_count: pages, p_pdf_size: head.size, p_images: imgRows });
  if (error) {
    const err = fromDbError(error);
    await failDeck(ctx, a.userId, deck_id, err.code); // e.g. daily_limit_reached: nothing consumed, object removed
    throw err;
  }
  return ok({ deck_id, page_count: pages, images: await imageUrls(ctx, a.userId, deck_id, pages), rules: RULES });
});
export { AppError };
