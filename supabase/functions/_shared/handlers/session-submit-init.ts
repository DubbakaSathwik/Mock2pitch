import { api, AppError, checkCanPractise, Errors, ok, readBody, reopenUploadingSession, requireUser } from "./common.ts";
import { sessionSubmitInitIn } from "../schemas.ts";
import { AUDIO_PUT_EXPIRES_S, MAX_CLIP_BYTES } from "../constants.ts";
import { keys } from "../r2.ts";

export const sessionSubmitInit = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { session_id, clips } = await readBody(ctx.req, sessionSubmitInitIn);
  const { deps } = ctx;

  // Admin / blocked / profile only. Policy acceptance is deliberately NOT re-checked (D15): an active session can always be submitted.
  await checkCanPractise(a, false, false);

  const { data: s } = await deps.admin.from("practice_sessions").select("id, deck_id, status, submitted_at").eq("id", session_id).eq("owner_id", a.userId).maybeSingle();
  if (!s) throw Errors.notFound();
  if (!["in_progress", "uploading_audio"].includes(s.status)) throw Errors.conflict("invalid_state");
  const { data: deck } = await deps.admin.from("decks").select("page_count").eq("id", s.deck_id).maybeSingle();
  const pages = deck?.page_count as number;

  const seen = new Set<number>();
  for (const c of clips) {
    if (c.slide_index >= pages) throw Errors.badRequest("invalid_slide_index", "That slide doesn't exist.");
    if (seen.has(c.slide_index)) throw Errors.badRequest("duplicate_slide_index", "Each slide can only be submitted once.");
    seen.add(c.slide_index);
    if (c.size_bytes > MAX_CLIP_BYTES) throw Errors.tooLarge("clip_too_large");
    if (c.size_bytes < 44) throw Errors.badRequest("clip_empty", "That recording is empty.");
  }

  // Re-init (e.g. after a failed upload): clip keys are deterministic and `files.object_key` is unique, so the existing rows are reused.
  // Clips that were already uploaded with the same size are kept (the client only re-sends the failed ones); clips that are no longer part
  // of the submission are retired.
  type Old = { id: string; slide_index: number; object_key: string; expected_size_bytes: number; status: string };
  const { data: oldRows } = await deps.admin.from("files").select("id, slide_index, object_key, expected_size_bytes, status").eq("session_id", session_id).eq("kind", "audio_clip");
  const old = new Map(((oldRows ?? []) as Old[]).map((f) => [f.slide_index, f]));
  for (const f of old.values()) {
    if (seen.has(f.slide_index) || !["pending", "uploaded"].includes(f.status)) continue;
    await deps.r2.delete(f.object_key).catch(() => {});
    await deps.admin.from("files").update({ status: "deleted", deleted_at: deps.now().toISOString() }).eq("id", f.id);
  }

  // A session of this student that was left in `uploading_audio` (tab closed mid-upload, rejected clip) holds the one-analysis slot until the
  // sweeper reopens it (1 h). Once its presigned URLs have expired it can never finish, so release it now instead of blocking this submit.
  const cutoff = new Date(deps.now().getTime() - (AUDIO_PUT_EXPIRES_S + 60) * 1000).toISOString();
  const { data: stale } = await deps.admin.from("practice_sessions").select("id").eq("owner_id", a.userId).eq("status", "uploading_audio").neq("id", session_id).lt("updated_at", cutoff);
  for (const o of (stale ?? []) as { id: string }[]) await reopenUploadingSession(deps, o.id);

  // One analysing session per user is enforced by a unique partial index.
  const { error } = await deps.admin.from("practice_sessions").update({
    status: "uploading_audio", error_code: null, submitted_at: s.submitted_at ?? deps.now().toISOString(),
  }).eq("id", session_id);
  if (error) {
    if (error.code === "23505") throw Errors.conflict("analysis_in_progress", "We're still analysing your previous session.");
    throw new AppError("internal", 500, "Something went wrong.");
  }

  const out = [];
  for (const c of clips) {
    const key = keys.audioClip(a.userId, session_id, c.slide_index);
    const prev = old.get(c.slide_index);
    if (prev) {
      const keep = prev.status === "uploaded" && Number(prev.expected_size_bytes) === c.size_bytes;
      if (!keep) {
        if (prev.status === "pending" || prev.status === "uploaded") await deps.r2.delete(prev.object_key).catch(() => {}); // a stale object must not satisfy the new declaration
        const { error: ue } = await deps.admin.from("files").update({ status: "pending", expected_size_bytes: c.size_bytes, size_bytes: null, uploaded_at: null, deleted_at: null }).eq("id", prev.id);
        if (ue) throw new AppError("internal", 500, "Something went wrong.");
      }
    } else {
      const { error: fe } = await deps.admin.from("files").insert({
        owner_id: a.userId, session_id, kind: "audio_clip", slide_index: c.slide_index, bucket: deps.r2.bucket, object_key: key,
        mime_type: "audio/wav", expected_size_bytes: c.size_bytes, status: "pending",
      });
      if (fe) throw new AppError("internal", 500, "Something went wrong.");
    }
    out.push({ slide_index: c.slide_index, upload: await deps.r2.presignPut(key, { contentType: "audio/wav", contentLength: c.size_bytes, expiresS: AUDIO_PUT_EXPIRES_S }) });
  }
  await deps.admin.rpc("svc_touch_active", { p_uid: a.userId });
  return ok({ session_id, clips: out });
});
