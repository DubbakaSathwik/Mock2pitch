# API contracts (what Phase 2/3 builds against)

Types: `types/database.ts` (generated; `npm run gen:types`). Base URL for functions: `https://<ref>.supabase.co/functions/v1/<name>`. All functions are `POST` with JSON and `Authorization: Bearer <user access token>`; unknown body fields are rejected (400).

**Envelope.** Success `{ "ok": true, "data": … }`. Failure `{ "ok": false, "error": { "code": "…", "message": "…", …extra } }`. `message` is safe to show; branch on `code`. HTTP: 400 validation · 401 unauthenticated · 403 forbidden · 404 not found / not yours · 405 · 409 state conflict · 413 too large · 429 daily limit or AI busy · 500 generic.

## Error codes the UI must map
| Code | HTTP | Where | UI |
|---|---|---|---|
| `not_authenticated` | 401 | any | sign-in |
| `policy_not_accepted` | 403 | upload-init, start session, rate | S3 "Terms updated" gate |
| `profile_incomplete` | 403 | upload-init, start, submit | S4 profile |
| `blocked` | 403 | all writes | blocked screen (reads still work) |
| `is_admin` | 403 | all student operations | admins never reach practice UI |
| `daily_limit_reached` | 429 | upload-init, upload-complete, start (retake) | **S18** limit screen; `my_dashboard_stats().next_reset_at` for the countdown |
| `not_pdf` | 400 | upload-init / complete | error below the dropzone |
| `too_large` | 413 | upload-init / complete | error below the dropzone (5 MB) |
| `too_many_pages` | 400 | upload-complete | "That deck has **N** slides" — `error.page_count`, `error.max_pages` |
| `encrypted_pdf`, `corrupt_pdf`, `size_mismatch`, `upload_missing` | 400 | upload-complete | upload error / retry |
| `deck_in_progress` | 409 | upload-init, deck-process | "Finish your current deck first" |
| `images_missing` (+`missing[]`), `not_jpeg`/`image_too_large` (+`slide_index`) | 400 | deck-process | re-render and re-upload those slides |
| `AI_BUSY` | 429 | (inside jobs) | surfaces as `ai_unavailable` below |
| `ai_unavailable` | – | `decks.error_code` / `practice_sessions.error_code` | "Our AI is busy, try again in a minute" + retry button (call `deck-process` / `session-analyse` again; nothing is re-charged) |
| `processing_failed`, `report_invalid`, `analysis_failed`, `audio_invalid`, `analysis_stalled`, `max_attempts` | – | row `error_code` | generic failure; `max_attempts` ⇒ ask the student to practise again |
| `analysis_in_progress` | 409 | submit-init / analyse | "still analysing your previous session" |
| `clip_missing`/`size_mismatch`/`audio_invalid` (+`slide_index`, `reason`) | 400 | analyse | re-record/re-upload that slide |
| `clip_too_large` (413), `clip_empty`, `invalid_slide_index`, `duplicate_slide_index` | 4xx | submit-init | client bug |
| `audio_expired`, `no_clips`, `invalid_state` | 409 | analyse | restart the session |
| `invalid_minutes`, `not_found`, `invalid_stars`, `comment_too_long`, `already_rated`, `not_latest_policy` | RPC | RPC `error.message` | inline validation |
| `misconfigured` | 500 | any | operator problem |

## Direct reads (supabase-js, RLS applies)
`profiles` (own row; update only `full_name, college, year, branch`), `policy_versions` (anon too: latest by `published_at`), `policy_acceptances`, `decks`, `slides`, `files` (no key columns), `practice_sessions`, `session_slide_results`, `reports`, `report_ratings`, `usage_events`. Subscribe to Realtime `postgres_changes` on `decks` and `practice_sessions` filtered by `id=eq.<id>`.

## Functions

### `deck-upload-init` — `{ filename, size_bytes, content_type }`
Pre-flight (`check_can_practise`), then:
```json
{ "ok": true, "data": { "deck_id": "uuid",
  "upload": { "url": "https://…r2…?X-Amz-…", "method": "PUT", "headers": { "Content-Type": "application/pdf", "Content-Length": "123456" }, "expires_at": "…" } } }
```
Client: `fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file })` (the browser sets Content-Length). An older deck still in `awaiting_upload` is superseded automatically.

### `deck-upload-complete` — `{ deck_id }`
Validates the stored file. On success **consumes one daily session** and returns:
```json
{ "ok": true, "data": { "deck_id": "uuid", "page_count": 8,
  "images": [ { "slide_index": 0, "upload": { "url": "…", "method": "PUT", "headers": { "Content-Type": "image/jpeg" }, "expires_at": "…" } } ],
  "rules": { "max_width": 1280, "min_width": 800, "jpeg_quality": 0.8, "min_jpeg_quality": 0.5, "max_bytes": 180000, "content_type": "image/jpeg" } } }
```
Idempotent while the deck is `awaiting_images` (re-issues URLs). Failures delete the object and set `decks.status='failed'` with the code in `decks.error_code`; nothing is consumed.

### `deck-process` — `{ deck_id }`
After all images are uploaded. `202 { deck_id, status: 'processing' }` (work continues in the background); `200 { status: 'ready' }` if already done. Retry after `ai_unavailable` by calling again. Watch `decks.status`, `processed_slides`, `processing_stage`.

### `asset-urls` — `{ deck_id, kinds: ['slide_image','deck_pdf'] }`
`{ deck_id, expires_at, files: [ { kind, slide_index, url } ] }` — 10-minute GET URLs. Own decks only (404 otherwise, indistinguishable from "does not exist"); admins get 403 `is_admin`.

### `session-submit-init` — `{ session_id, clips: [ { slide_index, size_bytes } ] }`
1–10 clips, unique indexes within the deck, ≤ 20 MB each. Policy acceptance is **not** re-checked (an active session can always be submitted). Moves the session to `uploading_audio` (re-callable to replace failed uploads).
```json
{ "ok": true, "data": { "session_id": "uuid", "clips": [ { "slide_index": 0, "upload": { "url": "…", "method": "PUT", "headers": { "Content-Type": "audio/wav", "Content-Length": "96044" }, "expires_at": "…" } } ] } }
```

### `session-analyse` — `{ session_id }`
After all clips are uploaded. `202 { session_id, status: 'transcribing' }`, or `200 { status: 'completed', report_id }`. Retry from `failed` by calling again (max 3 attempts; no extra daily session). A slide without a clip counts as "not recorded".

### `account-delete` — `{ confirm: "DELETE" }`
`{ deleted: true, storage_cleanup: 'complete' | 'pending' }` (`pending` ⇒ the sweeper finishes R2 cleanup). Admin ⇒ 403 `is_admin`. Sign the user out afterwards.

### `admin-ai-keys` — `{}` (admin only)
```json
{ "ok": true, "data": { "purposes": [ { "purpose": "slide_reading", "model": "…", "slots": [ { "slot_id": "uuid", "slot": "primary", "configured": true, "masked": "••••••••ab12" } ] } ] } }
```
Combine with `admin_ai_usage()` by `slot_id`.

### `maintenance-sweep` — internal only (`x-internal-secret`). Not for browsers.

## Realtime progress strings
- `decks.processing_stage`: `"Waiting for slide images"` (awaiting_images) → `"Reading slide k of N"` (processing) → `null` when `ready`. Also `processed_slides` (0..N). Statuses: `awaiting_upload, awaiting_images, processing, ready, failed`.
- `practice_sessions.analysis_stage`: `"Transcribing your recording"` → `"Transcribed k of m"` → `"Writing your report"` → `null`. Statuses: `in_progress, uploading_audio, transcribing, generating_report, completed, failed, abandoned`. When `completed`, read `reports` by `session_id`.

## RPCs (supabase-js `.rpc(name, args)`)
Signatures, outputs and error codes are in `supabase.md`. Examples:
```ts
await supabase.rpc('start_practice_session', { p_deck_id, p_total_minutes: 5 })   // → practice_sessions row incl. suggested_seconds[]
await supabase.rpc('rate_report', { p_report_id, p_stars: 4, p_comment: 'Helpful' })
await supabase.rpc('accept_policy', { p_version_id })
await supabase.rpc('my_dashboard_stats')   // { sessions_used_today, daily_limit: 5, next_reset_at, attempts_count, average_score, best_score, total_practice_ms, total_key_points_covered }
await supabase.rpc('admin_ai_usage', { p_days: 7 })  // { purposes: [ { purpose, slots: [ {slot_id, slot, credit_limit, used, remaining, percent_used, running_low, cooldown_until, last_error_code} ], per_day: [ {date, count} ] } ] }
```
`report` shape for the report screen: `reports` row (`overall_score, coverage_score, clarity_score, timing_score, filler_score, overall_wpm, total_duration_ms, key_points_covered/_total, filler_total, headline, top_fixes[3], did_well[3], delta_from_first, first_attempt_score`) + `session_slide_results` rows (per slide: `duration_ms, suggested_seconds, word_count, wpm, transcript, word_timings [{w,start_ms,end_ms}], filler_count, fillers [{word,count}], key_points_covered[], key_points_missed[], off_topic_quotes[], slide_feedback`). Indexes refer to `slides.key_points`.
