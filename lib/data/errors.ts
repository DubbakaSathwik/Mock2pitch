// Normalised error type used by every adapter. Mirrors the backend envelope: { code, message, ...extra }.
export const ERROR_CODES = [
  "not_authenticated", "policy_not_accepted", "profile_incomplete", "blocked", "is_admin", "forbidden", "daily_limit_reached",
  "not_pdf", "too_large", "too_many_pages", "encrypted_pdf", "corrupt_pdf", "size_mismatch", "upload_missing", "deck_in_progress",
  "images_missing", "not_jpeg", "image_too_large", "AI_BUSY", "ai_unavailable", "processing_failed", "report_invalid", "analysis_failed",
  "audio_invalid", "analysis_stalled", "max_attempts", "analysis_in_progress", "clip_missing", "clip_too_large", "clip_empty",
  "invalid_slide_index", "duplicate_slide_index", "audio_expired", "no_clips", "invalid_state", "invalid_minutes", "not_found",
  "invalid_stars", "comment_too_long", "already_rated", "not_latest_policy", "misconfigured", "invalid_label", "invalid_body",
  "label_not_increasing", "cannot_block_admin", "network_error", "upload_failed", "unknown",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode | string, message?: string, details: Record<string, unknown> = {}) {
    super(message ?? defaultMessage(code));
    this.name = "AppError";
    this.code = (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : "unknown";
    this.details = details;
  }
}

export function defaultMessage(code: string): string {
  switch (code) {
    case "daily_limit_reached": return "You've used all your practice sessions for today.";
    case "not_pdf": return "That file isn't a PDF.";
    case "too_large": return "That PDF is larger than 5 MB.";
    case "ai_unavailable": case "AI_BUSY": return "Our AI is busy right now. Try again in a minute.";
    case "network_error": return "We couldn't reach the server. Check your connection and try again.";
    case "upload_failed": return "The upload was interrupted. Check your connection and try again.";
    default: return "Something went wrong. Please try again.";
  }
}

/** Anything thrown by an adapter or fetch becomes an AppError (so components only ever branch on `code`). */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof DOMException && e.name === "AbortError") return new AppError("network_error", "Cancelled.");
  if (e instanceof TypeError) return new AppError("network_error");
  const o = e as { code?: string; message?: string } | null;
  if (o && typeof o === "object" && typeof o.code === "string") return new AppError(o.code, o.message);
  return new AppError("unknown", e instanceof Error ? undefined : undefined);
}

export const isCode = (e: unknown, ...codes: ErrorCode[]): boolean => e instanceof AppError && codes.includes(e.code);
