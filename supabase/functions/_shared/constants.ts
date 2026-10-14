// Single source of truth for product limits and scoring constants (shared by Deno Edge Functions and Vitest).

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_SLIDES = 10;
export const MIN_TOTAL_MINUTES = 1;
export const MAX_TOTAL_MINUTES = 20;
export const DAILY_SESSION_LIMIT = 5;
export const TIMEZONE = "Asia/Kolkata";

// Slide image rule (D6/§3.2): the browser renders each PDF page to JPEG at this width/quality.
// PROVISIONAL until the live vision spike (blocked: no NVIDIA access) confirms the inline payload limit. NVIDIA's hosted
// vision endpoints have historically capped inline base64 images at roughly 180 KB, so the conservative value is used: the
// client renders at <= max_width and lowers JPEG quality (to min quality) and then width until the file fits max_bytes.
export const SLIDE_IMAGE_MAX_WIDTH = 1280;
export const SLIDE_IMAGE_JPEG_QUALITY = 0.8;
export const SLIDE_IMAGE_MIN_JPEG_QUALITY = 0.5;
export const SLIDE_IMAGE_MIN_WIDTH = 800;
export const SLIDE_IMAGE_MAX_BYTES = 180_000;

// Audio rule (D8): 16 kHz mono 16-bit PCM WAV, <= ~10 min.
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_BITS = 16;
export const MAX_CLIP_BYTES = 20 * 1024 * 1024;

// Presign expiries (seconds)
export const PUT_EXPIRES_S = 5 * 60;
export const AUDIO_PUT_EXPIRES_S = 10 * 60;
export const GET_EXPIRES_S = 10 * 60;

// AI timeouts (ms) and concurrency
export const TIMEOUT_SLIDE_MS = 45_000;
export const TIMEOUT_ASR_MS = 60_000;
export const TIMEOUT_REPORT_MS = 90_000;
export const SLIDE_CONCURRENCY = 3;
export const ASR_CONCURRENCY = 3;

// Key routing
export const DEFAULT_COOLDOWN_429_S = 60;
export const COOLDOWN_5XX_S = 30;
export const COOLDOWN_AUTH_S = 600;
export const LOW_CREDIT_PCT = 75;

// Scoring v1 (D10). Thresholds below are defaults, NOT owner-specified (see handoff "Open questions").
export const SCORING_VERSION = "v1";
export const WEIGHTS = { coverage: 0.35, clarity: 0.25, timing: 0.2, fillers: 0.2 } as const;
export const TIMING_FULL_SCORE_BELOW = 0.05;
export const TIMING_ZERO_AT = 0.5;
export const FILLER_PENALTY_PER_MIN = 15;
export const FILLER_MIN_MINUTES = 0.5;
export const FILLER_REGEX_SOURCE = "\\b(um|uh|like|basically|you know|actually)\\b";

export const MAX_ANALYSIS_ATTEMPTS = 3;
export const STUCK_JOB_MS = 5 * 60 * 1000;
export const PENDING_FILE_TTL_MS = 60 * 60 * 1000;
export const AUDIO_HARD_TTL_MS = 24 * 60 * 60 * 1000;

export const COLLEGE_YEARS = ["3rd year", "4th year", "Other"] as const;
export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "Other"] as const;
export const PURPOSES = ["slide_reading", "speech_to_text", "report_generation"] as const;
export const SLOTS = ["primary", "fallback_1", "fallback_2"] as const;
export type Purpose = (typeof PURPOSES)[number];
export type Slot = (typeof SLOTS)[number];
