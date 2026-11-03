// Single source of truth for product limits and scoring constants (shared by Deno Edge Functions and Vitest).

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_SLIDES = 10;
export const MIN_TOTAL_MINUTES = 1;
export const MAX_TOTAL_MINUTES = 20;
export const DAILY_SESSION_LIMIT = 5;
export const TIMEZONE = "Asia/Kolkata";

// Slide image rule (D6/§3.2): the browser renders each PDF page to JPEG at this width/quality.
// Measured live (ops-selftest, 2026-10-14, meta/llama-3.2-11b-vision-instruct): inline base64 images of 133 KB, 233 KB,
// 433 KB, 833 KB and 1.6 MB were ALL accepted (HTTP 200). 1 MB leaves headroom; the client renders at <= max_width and
// lowers JPEG quality (to min quality) and then width until the file fits max_bytes.
export const SLIDE_IMAGE_MAX_WIDTH = 1280;
export const SLIDE_IMAGE_JPEG_QUALITY = 0.8;
export const SLIDE_IMAGE_MIN_JPEG_QUALITY = 0.5;
export const SLIDE_IMAGE_MIN_WIDTH = 800;
export const SLIDE_IMAGE_MAX_BYTES = 1_000_000;

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
export const TIMEOUT_SLIDE_MS = 30_000; // a healthy Gemini Flash answer takes a few seconds; anything slower is overload, so move on to the next key / model
export const TIMEOUT_ASR_MS = 60_000;
export const TIMEOUT_REPORT_MS = 90_000;
export const SLIDE_CONCURRENCY = 3;
export const ASR_CONCURRENCY = 3;

// Key routing
export const DEFAULT_COOLDOWN_429_S = 60;
export const COOLDOWN_5XX_S = 30;
export const SAME_KEY_RETRY_DELAY_MS = 1500; // one retry of the last usable key after a transient 5xx/network error, before cooling it down
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

// Presentation details form (audience / goal / summary / time), see migration 20261104000011.
export const AUDIENCES = ["student", "teachers", "jury", "others"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABELS: Record<Audience, string> = { student: "Students", teachers: "Teachers", jury: "Jury", others: "Others" };
export const MAX_AUDIENCE_OTHER_CHARS = 80;
export const MAX_GOAL_CHARS = 300;
export const MAX_ABSTRACT_WORDS = 50;
export const MAX_ABSTRACT_CHARS = 600;
/** Spoken English pace used to size scripts: about 130 words a minute. */
export const WORDS_PER_SECOND = 130 / 60;

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
