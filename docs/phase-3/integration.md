# Phase 3 — integration results (real Supabase + Cloudflare R2 + NVIDIA)

Everything below ran **from the user's side**: a real Chromium (Playwright) against the Next.js app in `NEXT_PUBLIC_DATA_MODE=supabase`
(local `next dev` on :3000), talking to the hosted project `mkglxcdtfimgmvxtddst`, bucket `mock2pitch-dev` and the NVIDIA endpoints.
DB/R2 state was then checked as the user (RLS reads), as service (SQL through the Supabase tools) or by presigned-URL status codes.
Specs: `e2e-int/01…10`, run with `npm run test:integration` (see `e2e-int/README.md`).

**Not covered here (and why):** Google sign-in itself (needs the owner's Google OAuth client; the tests sign in test users with a password
and install the same `@supabase/ssr` cookies the OAuth callback would write), the deployed Netlify site (deferred by the owner until local
testing is finished), Lighthouse on the deployed site, WebKit/Safari and real-device recording (`device-checks.md`), a human "um/uh" clip
(`fillers.md`).

## 1. Environment decisions
* **One Supabase project and one R2 bucket are production** (owner decision 2026-10-15). All test traffic used `@mock2pitch.test` users,
  the smallest fixtures (3-page PDF, ~5.6 s clips), and was deleted afterwards (section 6).
* Test sign-in: Email provider enabled **temporarily**, Google-only sign-up enforced by the Auth hook (`hook_before_user_created`) and by a
  DB trigger guard on `auth.users` (migration `…0010`). The hook is not yet enabled in the dashboard (owner step B3), which is why the DB guard exists.

## 2. User journeys (flow → result)
| Flow | Where | Result |
|---|---|---|
| 5.1 First-time student: sign-in guard → Terms → profile → dashboard | spec 02 | pass. `policy_acceptances` row = latest version; `profiles` filled, `profile_completed_at` set |
| 5.2 Upload 3-slide PDF → reading (Realtime) → prepare with real images from R2 | spec 02 | pass. Deck `ready`, `processed_slides=3`; 3 `slides` with key points; images load from presigned R2 URLs; 1 daily session consumed |
| 5.3 Time → mic check → practice room → record → review → submit → analysing → report | spec 02 / 07 | pass with the fake microphone (a 5.58 s file). Report scores, per-slide transcript, WPM, fillers, advice rendered; audio deleted from R2 after analysis (`files.status=deleted`) |
| 5.3 AI-busy path | spec 02 (before the router fix) | the report model returned 503 → UI showed "AI busy", Try again re-ran only the failed stage; fixed properly in section 5 |
| 5.4 Rate report once; retake creates attempt 2; history; pin; deck detail | spec 02 | pass. Second `rate_report` → `already_rated`; attempt numbers 1, 2 |
| 5.5 Server-side upload validation (client checks bypassed) | spec 03 | pass: `not_pdf` (type, name, content), `too_large` (413), `encrypted_pdf`, `corrupt_pdf`, `too_many_pages` (+page_count 11/max 10), `upload_missing`; wrong signed Content-Type / short body refused by R2; no session consumed by any rejected upload |
| 5.5 Invalid audio | spec 08 | pass: stereo → `reason=not_mono`, 44.1 kHz → `bad_sample_rate`, non-RIFF → `not_riff_wave`; HTTP 400 `audio_invalid` with `slide_index`; object deleted, file `failed`, **0 NVIDIA calls** (`ai_usage_log` max id unchanged), no result/report rows |
| 5.5 Daily limit | spec 06 | pass: B has 5 events today → `/limit` "Time to rest… resets at midnight IST"; direct `deck-upload-init` → 429 `daily_limit_reached`; `next_reset_at` = next IST midnight (18:30 UTC); no deck created |
| 5.5 Client-side checks | spec 06 | 11-slide PDF → "That deck has 11 slides", no backend call |
| 5.6 R2 failures in the browser | spec 07 (desktop and mobile) | an expired/refused image PUT → fresh URLs + retry, **one** daily session; an aborted clip PUT → "Try again" re-sends only that clip; analysis completes |
| 5.7 Admin | spec 05 | pass (desktop and mobile): admin lands on `/admin`, never sees student UI or the Terms gate; overview, students (search, pagination with `total_count`), detail, ratings, AI usage show real data; admin has no access to student content and cannot start practice (`is_admin`); cannot block self |
| 5.7 Block / unblock | spec 05 | blocked student: reads keep working, every write refused (`blocked`), UI shows the paused screen; unblock restores |
| 5.8 Account deletion | spec 10 | pass. Deck uploaded, presigned image + PDF URLs returned 200; Settings → Delete account (typed `DELETE`) → landing with "Your account was deleted"; the same URLs now **404**; password sign-in fails; the old session reads 0 decks; `/dashboard` → sign-in. SQL residue for that user: auth user, profile, decks, slides, files, usage, acceptances = 0; `ai_usage_log` rows kept **anonymised** (`user_id` null) |
| 5.9 Policy republish | spec 09 | pass: owner publishes `v1.0.1` while a student is signed in; next navigation → `/onboarding/terms` with "We've updated our terms" and the version label; Continue disabled until the box is ticked; after accepting, 2 acceptance rows (history kept) |
| 5.10 Guards, deep links, redirects | specs 01, 06 | pass: signed-out deep link → sign-in with `next`, opens after sign-in; open redirects ignored; OAuth error codes show the sign-in error; public pages read the real policy |

## 3. Isolation and security (spec 04, desktop)
User B cannot read any of NEW's rows (profiles, decks, slides, sessions, results, reports, ratings, usage, acceptances, files);
cannot write or escalate (role/blocked/etc.); server-only tables and admin RPCs are denied to students; student RPCs/functions on another
user's objects answer `not_found` (indistinguishable from "does not exist"); `files` exposes no object keys and never audio clips;
Realtime: B receives nothing for NEW's rows, NEW does. Details and the findings are in `security-review.md`.

## 4. Test runs (counts)
| Suite | Result |
|---|---|
| Integration desktop (specs 01, 03–06 in one run; 02, 07, 08, 09, 10 individually) | all pass (01+03+04+05+06 = 22 tests across two runs after fixing B's seed date; 08, 09, 10 pass) |
| Integration mobile (Pixel 7, 390×844): 01, 05, 06, 07 | 01 ✓ (2), 05 ✓ (3), 06 ✓ (3), 07 ✓ (full practice flow as a fresh user) |
| `npm run typecheck` / `npm run lint` | clean |
| Unit + frontend (Vitest) | 73 + 141 = 214 passed |
| Edge Function handlers + DB (Vitest, local PostgreSQL 16) | 170 passed |
| Mock-mode E2E (Playwright): desktop / mobile / a11y | 23 passed (1 mobile-only skipped) / 23 passed / a11y sweep passed |
| `NEXT_PUBLIC_DATA_MODE=supabase npm run build` + `scan:bundle` + `check-prod-bundle` | build OK (32 routes); client bundle clean; no mock backend in the supabase-mode bundle |

## 5. Backend changes made in Phase 3 (each proven necessary by integration)
1. `20261015000009_auth_hook_google_only.sql` — `hook_before_user_created` (rejects non-Google sign-ups). Additive.
2. `20261015000010_auth_users_google_only_guard.sql` — trigger guard on `auth.users` because public email sign-up was possible while the hook is not enabled in the dashboard. Additive; the test users are inserted by SQL and are unaffected.
3. `session-submit-init`: a second init for the same slide returned HTTP 500 (unique `files.object_key`) and deleted clips that were already uploaded → rows are now reused, uploaded clips with the same declared size are kept, retired slides are cleaned. Test added (`tests/functions/session.test.ts`).
4. `nvidia/router.ts`: a transient 5xx/network error on the **last usable key** is retried once on the same key (1.5 s) before the key is cooled down for 30 s. Without it a single 503 on the report model cooled the only key and the next 3 UI retries were burned inside the cooldown (`analysis_attempts` hit the cap of 3 and the session failed). 3 unit tests added. **Live proof:** a later report call returned 503 after 266 ms, the router waited 1.5 s and the same key answered 200 after 34 s — one `server_error` row and one `success` row in `ai_usage_log`, no UI retry needed.
5. Frontend (not backend): after an AI-busy failure the UI disables "Try again" for 30 s (`AI_RETRY_DELAY_S`; 2 s in mock mode) so the user does not spend an attempt inside a key cooldown.

## 6. AI credits consumed (from `ai_usage_log`, whole project history incl. Phase 1 spikes)
| Purpose | Successful | Billable (success + invalid_output) | Failed calls | Tokens / audio |
|---|---|---|---|---|
| slide_reading | 22 | 25 | 5 (one HTTP 410 on a retired model slot in Phase 1, one invalid output) | 161 171 prompt / 3 421 completion |
| speech_to_text | 8 | 8 | 1 (network) | 45 s of audio |
| report_generation | 5 | 5 | 3 (HTTP 503 on the report model) | 3 015 prompt / 4 304 completion |
Complete analyses (ASR + report) in Phase 3: 4 (NEW ×2, A ×1, DEL on mobile ×1; the limit was ≤ 10 per run); the 5th successful report in the table is from the Phase 1 spikes. Audio_invalid and all upload-validation tests used **0** credits.
Latency (successful calls): slide reading 3.8–18.4 s per slide (≈ 9.9 s avg), ASR ≈ 0.9 s for 5.6 s of audio, report 16–34 s.
Submit → report (no failures in between): 29 s and 53 s (the 53 s case includes the 1.5 s same-key retry after a 503).

## 7. Cleanup and residue
* All five test users (`it.new`, `it.a`, `it.b`, `it.del`, `it.admin`) were removed with `scripts/integration/cleanup-via-api.mjs`, which calls the real
  `account-delete` function for each (R2 prefix deleted first, then the auth user; every call returned `storage_cleanup: "complete"`).
  The admin was demoted by an UPDATE first (the function refuses to delete an admin).
* Residue query after cleanup, all **0**: `auth.users` (all and `@mock2pitch.test`), `profiles`, `decks`, `slides`, `files`, `practice_sessions`,
  `session_slide_results`, `reports`, `report_ratings`, `usage_events`, `policy_acceptances`, `ai_usage_log` rows carrying a user id.
  `ai_usage_log` keeps 44 **anonymised** rows by design (`user_id` null) — they are the credit evidence above.
* R2: the bucket is expected to be empty. The sandbox has no R2 listing credentials; evidence is the 404 on presigned URLs (spec 10),
  `deletePrefix` returning `complete` for each user, and the `files` table being empty. **Owner check:** Cloudflare dashboard → R2 → `mock2pitch-dev` → Objects shows none.
* **One test artefact remains:** policy version `v1.0.1` (note "integration test (same text)", the same text as `v1.0`). Removing it is a DELETE that the
  Supabase tool holds for the owner's confirmation (it timed out). It is harmless (identical text; students simply re-accept) but the owner can remove it with
  `delete from policy_versions where version_label = 'v1.0.1' and note = 'integration test (same text)';` in the SQL editor, or leave it and publish `v1.1` later.
* Still to do by the owner: turn the Email provider **off** before launch.

## 8. Findings worth knowing (all handled or documented)
1. **A session stuck in `uploading_audio` blocks the user's next analysis** (unique partial index `sessions_one_analysing_per_owner`) until the 1 h sweeper reopens it. Reproduced by rejected audio. By design for the one-analysis-per-user rule; the UI shows `analysis_in_progress`. Phase 4 idea: let the user abandon such a session.
2. **The report model (`nvidia/nemotron-3-ultra-550b-a55b`) returns intermittent 503s** (3 in ~8 calls on the day of testing). Mitigated by the same-key retry and the UI delay; a second report key slot (fallback) is recommended to the owner (Admin → AI usage → keys).
3. **Supabase MCP `execute_sql` holds DELETE statements for user confirmation** and times out after 60 s; non-destructive UPDATEs and the product's own deletion path were used instead (section 7).
4. **Parakeet drops "um/uh"** (`fillers.md`).
5. The shared Gate had a bug: the first `SIGNED_IN` auth event cleared the UI caches and left the app on a spinner → fixed (INITIAL_SESSION baseline) with a unit test.
6. `masked: null` for an unconfigured AI key slot broke the admin AI-keys schema → schema accepts null.
7. Sandbox only: Node ignores the egress proxy unless `NODE_USE_ENV_PROXY=1`; Playwright wipes `test-results/` on each run (shared state is in `.integration-state.json`); Next dev allows one server per directory (stop the :3000 server before the mock E2E, which starts its own on :3100).
