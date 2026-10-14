import { api, AppError, isInternal, logEvent, ok } from "./common.ts";
import { AUDIO_HARD_TTL_MS, MAX_ANALYSIS_ATTEMPTS, PENDING_FILE_TTL_MS, STUCK_JOB_MS } from "../constants.ts";
import type { Deps } from "../deps.ts";

const iso = (deps: Deps, ago: number) => new Date(deps.now().getTime() - ago).toISOString();

/** Idempotent cleanup + resume. Logs counts only. */
export const maintenanceSweep = api(async (ctx) => {
  if (!isInternal(ctx.req, ctx.deps)) throw new AppError("forbidden", 403, "You can't do that.");
  const { deps } = ctx;
  const counts = { pending_files_failed: 0, decks_failed: 0, sessions_reopened: 0, sessions_abandoned: 0, audio_deleted: 0, sessions_resumed: 0, sessions_failed: 0, decks_resumed: 0, deletions_finished: 0 };

  // 1a) files stuck 'pending' > 1h: remove object if present, mark failed.
  const { data: pending } = await deps.admin.from("files").select("id, object_key").eq("status", "pending").lt("created_at", iso(deps, PENDING_FILE_TTL_MS));
  for (const f of (pending ?? []) as { id: string; object_key: string }[]) {
    try { await deps.r2.delete(f.object_key); } catch { continue; }
    await deps.admin.from("files").update({ status: "failed" }).eq("id", f.id);
    counts.pending_files_failed++;
  }
  // 1b) decks stuck waiting for uploads > 1h.
  const { data: stuckDecks } = await deps.admin.from("decks").select("id").in("status", ["awaiting_upload", "awaiting_images"]).lt("updated_at", iso(deps, PENDING_FILE_TTL_MS));
  for (const d of (stuckDecks ?? []) as { id: string }[]) {
    await deps.admin.from("decks").update({ status: "failed", error_code: "upload_timeout", processing_stage: null }).eq("id", d.id);
    counts.decks_failed++;
  }
  // 1c) sessions that never finished uploading audio go back to 'in_progress' (the student can submit again).
  const { data: upl } = await deps.admin.from("practice_sessions").select("id").eq("status", "uploading_audio").lt("updated_at", iso(deps, PENDING_FILE_TTL_MS));
  for (const s of (upl ?? []) as { id: string }[]) {
    const { data: left } = await deps.admin.from("files").select("id, object_key, status").eq("session_id", s.id).eq("kind", "audio_clip").in("status", ["pending", "uploaded"]);
    let ok_ = true;
    for (const f of (left ?? []) as { id: string; object_key: string }[]) {
      try { await deps.r2.delete(f.object_key); await deps.admin.from("files").update({ status: "deleted", deleted_at: deps.now().toISOString() }).eq("id", f.id); } catch { ok_ = false; }
    }
    if (ok_) { await deps.admin.from("practice_sessions").update({ status: "in_progress" }).eq("id", s.id); counts.sessions_reopened++; }
  }
  // 1d) never-submitted sessions older than 24h are abandoned.
  const { data: idle } = await deps.admin.from("practice_sessions").select("id").eq("status", "in_progress").lt("created_at", iso(deps, AUDIO_HARD_TTL_MS));
  for (const s of (idle ?? []) as { id: string }[]) { await deps.admin.from("practice_sessions").update({ status: "abandoned" }).eq("id", s.id); counts.sessions_abandoned++; }

  // 2) audio older than 24h, whatever the session state: delete from R2 first, then mark deleted.
  const { data: oldAudio } = await deps.admin.from("files").select("id, object_key").eq("kind", "audio_clip").eq("status", "uploaded").lt("created_at", iso(deps, AUDIO_HARD_TTL_MS));
  for (const f of (oldAudio ?? []) as { id: string; object_key: string }[]) {
    try { await deps.r2.delete(f.object_key); } catch { continue; }
    await deps.admin.from("files").update({ status: "deleted", deleted_at: deps.now().toISOString() }).eq("id", f.id);
    counts.audio_deleted++;
  }

  // 3) analysis stuck > 5 min: resume (attempt limit applies inside session-analyse) or fail.
  const { data: stuck } = await deps.admin.from("practice_sessions").select("id, analysis_attempts").in("status", ["transcribing", "generating_report"]).lt("updated_at", iso(deps, STUCK_JOB_MS));
  for (const s of (stuck ?? []) as { id: string; analysis_attempts: number }[]) {
    if (s.analysis_attempts >= MAX_ANALYSIS_ATTEMPTS) {
      await deps.admin.from("practice_sessions").update({ status: "failed", error_code: "analysis_stalled", analysis_stage: null }).eq("id", s.id);
      counts.sessions_failed++;
    } else {
      await deps.invoke("session-analyse", { session_id: s.id }).catch(() => {});
      counts.sessions_resumed++;
    }
  }
  // 4) deck processing stuck > 5 min: resume.
  const { data: decks } = await deps.admin.from("decks").select("id").eq("status", "processing").lt("updated_at", iso(deps, STUCK_JOB_MS));
  for (const d of (decks ?? []) as { id: string }[]) { await deps.invoke("deck-process", { deck_id: d.id }).catch(() => {}); counts.decks_resumed++; }

  // 5) unfinished account-deletion cleanups.
  const { data: dels } = await deps.admin.rpc("svc_pending_deletions");
  for (const d of (dels ?? []) as { user_id: string; prefix: string }[]) {
    try {
      await deps.r2.deletePrefix(d.prefix);
      await deps.admin.rpc("svc_finish_account_deletion", { p_uid: d.user_id });
      counts.deletions_finished++;
    } catch { /* retried next run */ }
  }
  logEvent("maintenance_sweep", counts);
  return ok(counts);
});
