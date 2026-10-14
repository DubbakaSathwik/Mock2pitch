# AI pipeline reference

## Purposes, models, keys
| Purpose | Model env var | Keys (env) | Protocol |
|---|---|---|---|
| `slide_reading` | `NVIDIA_SLIDE_MODEL` | `NVIDIA_SLIDE_KEY_PRIMARY / _FALLBACK_1 / _FALLBACK_2` | OpenAI-compatible `chat/completions`, image as base64 data URL |
| `speech_to_text` | `NVIDIA_ASR_FUNCTION_ID`, label `NVIDIA_ASR_MODEL_LABEL` | `NVIDIA_ASR_KEY_*` | Riva gRPC `Recognize` (offline), sent as a direct HTTP/2 call (grpc-js does not connect in the Edge Runtime) |
| `report_generation` | `NVIDIA_REPORT_MODEL` | `NVIDIA_REPORT_KEY_*` | OpenAI-compatible `chat/completions` |

One model per purpose, used by all three keys of that purpose (D9). A slot whose env var is empty is skipped. **The models in `.env.example` are defaults to try first; none has been verified live** (see `spikes.md`). Keys never reach the browser, logs, responses or the database; the admin sees only `••••••••<last4>` via `admin-ai-keys`.

## Routing (`_shared/nvidia/router.ts`, 13 unit tests)
Candidates are tried primary → fallback_1 → fallback_2. A slot is skipped if its `cooldown_until` is in the future, it made ≥ `NVIDIA_KEY_RPM_SOFT_LIMIT` (35) requests in the last 60 s, or its used credits ≥ `credit_limit`.
| Result | Action |
|---|---|
| 2xx and output valid | return; log `success` |
| 2xx but output invalid | log `invalid_output` (billable); **do not rotate**; caller retries once |
| 429 | cooldown = `Retry-After` (default 60 s); log `rate_limited`; next slot immediately |
| 5xx / network / timeout | cooldown 30 s; log `server_error` / `timeout`; next slot |
| 401 / 403 | cooldown 10 min, `last_error_code='auth'`; next slot (shown in `admin_ai_usage`) |
| 400 / 422 | log `bad_request`; **do not rotate**; fail the step |
| nothing eligible | `AI_BUSY` (HTTP 429, retryable) |
Timeouts: slide 45 s, ASR 60 s per ≤ 60 s chunk, report 90 s. Measured live: slide ≈ 8 s, ASR ≈ 1.7 s per 6 s clip, report up to ≈ 30 s for the full prompt. Concurrency: 3 slides / 3 clips at once. Every attempt writes one `ai_usage_log` row (purpose, slot, model, outcome, status, latency, tokens or audio ms, user/deck/session ids). **Never** prompt text, transcripts or keys.

## Credit accounting
No NVIDIA balance API exists. "Used" = billable outcomes (`success`, `invalid_output`) since the slot's `credit_period_start`; "limit" = `ai_key_slots.credit_limit` (seeded 1000, editable with `admin_set_credit_limit`, which can also start a new period for a fresh key). `running_low` = > 75 % used. `NVIDIA_KEY_DEFAULT_CREDIT_LIMIT` is validated but the DB default (1000) is what seeds slots.

## Prompts (committed as files)
`_shared/prompts/slide-reading.ts`, `_shared/prompts/report.ts`. Copy rules for the report: calm encouraging coach, "you", specific numbers and slide numbers, British/Indian English, no emoji.

## Output schemas (Zod, `_shared/schemas.ts`)
- Slide: `{title ≤120, slide_text ≤4000, key_points[1..5] each ≤200, suggested_script ≤1500, time_weight 1..100}`. Extra fields are dropped; numbers clamped; strings truncated. Invalid twice, or a 400 from the API ⇒ a generic row (`"Introduce this slide"`, weight 10); only `AI_BUSY` fails the deck.
- Report: `{slides[{slide_index, key_points_covered[], key_points_missed[], off_topic_quotes[≤3], feedback?≤200}], clarity_score 0..100, headline ≤140, top_fixes[3], did_well[3]}`. One repair retry on invalid output, then `report_invalid` with the audio kept.

## Prompt-injection safeguards (tested)
System prompts state that slides/transcripts are data. Model output controls only the fields it fills: indexes outside `0..key_points-1` are dropped, `missed` is **derived** as "not covered", an off-topic quote survives only if it is an exact substring of that slide's transcript, an empty transcript forces "nothing covered", clarity is clamped, and scores come from `scoring.ts`, not the model (only `clarity_score` is model-supplied).

## Deck processing & analysis states
See `architecture.md`. Idempotency: slides upsert on `(deck_id, slide_index)`; transcripts upsert on `(session_id, slide_index)`; `svc_finalize_report` refuses to run twice (`invalid_state`) and inserts the report with `on conflict (session_id)`.

## Scoring formulas & constants (`v1`, `constants.ts`)
Weights 35/25/20/20; timing full-score band ±5 %, zero at ±50 %; filler penalty 15 points per filler/min with a 0.5 min floor; filler regex `\b(um|uh|like|basically|you know|actually)\b` (case-insensitive). These are defaults, not owner-specified.

## Filler-detection accuracy
**Measured on a synthetic (text-to-speech) clip:** 3 of 4 spoken fillers survived ("uh" was dropped), so the filler score can under-count slightly. A human recording is still needed for the real figure. The weights are unchanged; this is documented only.
