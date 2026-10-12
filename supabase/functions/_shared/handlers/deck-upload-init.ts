import { api, AppError, checkCanPractise, Errors, fromDbError, ok, readBody, requireUser } from "./common.ts";
import { deckUploadInitIn } from "../schemas.ts";
import { MAX_PDF_BYTES, PUT_EXPIRES_S } from "../constants.ts";
import { normaliseFilename, titleFromFilename } from "../files.ts";
import { keys } from "../r2.ts";

export const deckUploadInit = api(async ({ req, deps }) => {
  const a = await requireUser({ req, deps, cors: {} });
  const body = await readBody(req, deckUploadInitIn);

  // Fast-fail on every rule that doesn't need the file (nothing is consumed yet).
  await checkCanPractise(a, true, true);

  const filename = normaliseFilename(body.filename);
  if (body.content_type !== "application/pdf" || !/\.pdf$/i.test(filename)) throw Errors.badRequest("not_pdf", "Please upload a PDF file.");
  if (body.size_bytes > MAX_PDF_BYTES) throw Errors.tooLarge("too_large");

  // A deck still waiting for its PDF (e.g. the tab was closed) must not block a fresh attempt: nothing was consumed for it.
  const { data: stale } = await deps.admin.from("decks").select("id").eq("owner_id", a.userId).eq("status", "awaiting_upload");
  for (const d of (stale ?? []) as { id: string }[]) {
    await deps.r2.delete(keys.deckPdf(a.userId, d.id)).catch(() => {});
    await deps.admin.from("files").update({ status: "failed" }).eq("deck_id", d.id).eq("status", "pending");
    await deps.admin.from("decks").update({ status: "failed", error_code: "abandoned_upload" }).eq("id", d.id);
  }

  const deckId = crypto.randomUUID();
  const { error: dErr } = await deps.admin.from("decks").insert({
    id: deckId, owner_id: a.userId, title: titleFromFilename(filename), original_filename: filename, status: "awaiting_upload",
  });
  if (dErr) {
    if (dErr.code === "23505") throw Errors.conflict("deck_in_progress", "Finish your current deck first.");
    throw fromDbError(dErr);
  }
  const key = keys.deckPdf(a.userId, deckId);
  const { error: fErr } = await deps.admin.from("files").insert({
    owner_id: a.userId, deck_id: deckId, kind: "deck_pdf", bucket: deps.r2.bucket, object_key: key,
    mime_type: "application/pdf", expected_size_bytes: body.size_bytes, status: "pending",
  });
  if (fErr) {
    await deps.admin.from("decks").delete().eq("id", deckId);
    throw new AppError("internal", 500, "Something went wrong.");
  }
  await deps.admin.rpc("svc_touch_active", { p_uid: a.userId });
  const upload = await deps.r2.presignPut(key, { contentType: "application/pdf", contentLength: body.size_bytes, expiresS: PUT_EXPIRES_S });
  return ok({ deck_id: deckId, upload });
});
