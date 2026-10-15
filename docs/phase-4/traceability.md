# Requirements traceability (Phase 4)

Legend — **Result:** ✅ verified in Phase 4 · ⏳ not yet verifiable (needs the deployed site, Google OAuth, a real device or the owner) · ❌ failed (see note).
**Where verified:** `INT-n` = `e2e-int/<n>-*.spec.ts` against the real Supabase + R2 + NVIDIA stack from the local app (Phase 4 run, 2026-10-15); `MOCK` = mock-mode Playwright (`e2e/`) / Vitest; `CI` = GitHub Actions run 20+; `SQL` = checked directly in the database. Rows marked ⏳ get their final Phase 4 evidence on the deployed site (cut-over run) — they are not claimed done.

## A. MVP scope (document)
| # | Requirement | Implemented in | Phase 4 verification | Result |
|---|---|---|---|---|
| A1 | Login / sign-up with Google only | `features/auth/*`, `app/auth/callback/route.ts`, `proxy.ts`, Auth hook + `…0010` guard | INT-06 (deep links, OAuth error codes, open redirects), INT-04 (hook RPC not callable); sign-up rejection of email: DB guard test `tests/db/auth-hook.test.ts`; real Google round trip → owner step | ⏳ Google; ✅ guard |
| A2 | Terms & Privacy shown, accepted before use | `features/policy/*`, `accept_policy`, gate | INT-02 (5.1 first-time Terms), INT-01 (public pages read the live policy) | ✅ |
| A3 | Upload PDF (≤ 10 slides, ≤ 5 MB) | `features/upload/*`, `deck-upload-*` | INT-02 (5.2), INT-03 (type, name, size, content, encrypted, corrupt, >10 pages), INT-06 (client 11-slide check) | ✅ |
| A4 | Content extraction (slide images, key points, script) | pdf.js client render, `deck-process` + vision model | INT-02 (5.2: 3 slides ready, key points, images from R2) | ✅ |
| A5 | Time frame (target duration, suggested seconds per slide) | S9 `/practice/[deck]/time`, `start_practice_session` | INT-02 (5.3) | ✅ |
| A6 | Voice analyser (record per slide, WAV 16 kHz mono, ASR, WPM, fillers) | `features/practice/*`, `lib/audio`, `session-analyse` + Parakeet | INT-02 (5.3), INT-07 (resilient uploads, desktop + mobile), INT-08 (invalid audio), INT-11 (recovery); human filler clip → device step | ✅ synthetic · ⏳ human |
| A7 | Feedback generation (scores, advice) | `session-analyse` + report model, `computeScores` | INT-02 (5.3 report), INT-11; scoring unit tests (`tests/unit/scoring.test.ts`) | ✅ |
| A8 | AI slide script generator | `deck-process` (suggested script per slide) | INT-02 (5.2 prepare screen shows script/key points) | ✅ |
| A9 | Feedback rating (1–5 stars + comment, once per report) | `rate_report`, report rating card | INT-02 (5.4: second rate → `already_rated`) | ✅ |
| A10 | History (reports, pin, deck detail, first-vs-latest) | `features/history/*`, `my_decks`, `my_deck_detail` | INT-02 (5.4) | ✅ |
| A11 | Owner views all students (search, detail, block/unblock) | `features/admin/*`, `admin_*` RPCs | INT-05 (desktop; mobile re-run in cut-over) | ✅ |
| A12 | Analytics and AI metrics (overview, sessions/day, ratings, AI usage with key slots) | Admin Overview, Ratings, AI usage; `admin-ai-keys` | INT-05; SQL monitoring queries (`docs/operations/monitoring.md`) validated against live data | ✅ |
| A13 | Terms/Privacy update + re-accept | Admin Terms editor, `admin_publish_policy`, gate | Phase 3 spec 09 (publish while signed in → updated-terms screen); final proof = publishing **v1.1** at cut-over with the test students | ⏳ (v1.1 publication) |

## B. Locked decisions
| # | Decision | Verification | Result |
|---|---|---|---|
| B1 | One Owner Admin `dubbakasathwik@gmail.com`; cannot practise; never policy-gated | INT-05 (admin lands on `/admin`, `is_admin` on practice, no Terms gate); real owner login → owner step | ✅ test admin · ⏳ real owner |
| B2 | PDF only, ≤ 5 MB, ≤ 10 pages, server-side | INT-03 | ✅ |
| B3 | Real slide images (not text placeholders) | INT-02 (images load from presigned R2 URLs) | ✅ |
| B4 | 3 AI purposes × 3 key slots, one model each | `ai_key_slots` (9 rows, SQL); INT-05 AI usage 3×3; models per purpose in `ai_usage_log.model` | ✅ (fallback keys: not configured → launch risk) |
| B5 | Parakeet via gRPC/HTTP2 in the Edge Runtime | INT-02/07/11: `speech_to_text` rows `success` ~0.5–1 s (SQL) | ✅ |
| B6 | WAV 16 kHz mono 16-bit uploaded at submit; audio deleted after the report | INT-08 (format rejected), INT-02 (`files.status=deleted` after report, SQL) | ✅ |
| B7 | Scoring: Coverage 35 / Clarity 25 / Timing 20 / Fillers 20, Pacing info only; `scoring_version v1` | `tests/unit/scoring.test.ts`; report shows 4 scored + Pacing "For your information" (MOCK journey-2, INT-02) | ✅ |
| B8 | 5 sessions/day IST, counted on validated upload and each retake | INT-06 (limit screen, 429, IST reset 18:30 UTC); INT-02 (retake consumes one) | ✅ |
| B9 | PDF + slide images kept; audio deleted | SQL `files` after INT-02; sweeper deletes audio >24 h (functions test) | ✅ |
| B10 | Self-serve account deletion (rows + R2 + auth user) | Phase 3 INT-10 (URLs 404, residue 0); re-run in the cut-over regression | ✅ Phase 3 · ⏳ re-run |
| B11 | Terms/Privacy versioned; re-accept outside active sessions | functions + frontend tests (D15); INT-02/INT-09 | ✅ / ⏳ v1.1 |

## C. Design screens and states
| Screen | Where | Verification | Result |
|---|---|---|---|
| S1 Landing · S2 Sign-in · A0 Admin sign-in | `/`, `/sign-in`, `/admin/sign-in` | INT-01/06, MOCK journey-1/10, axe | ✅ |
| S3 Terms/Privacy (first time, updated, view-only) | `/onboarding/terms`, `/terms`, `/privacy` | INT-01/02, MOCK journey-1 | ✅ (updated: ⏳ v1.1) |
| S4 Profile | `/onboarding/profile` | INT-02 | ✅ |
| S5 Dashboard | `/dashboard` | INT-01/02/06 | ✅ |
| S6 Upload · S7 Reading · S8 Prepare · S9 Time | `/practice/*` | INT-02/03/07 | ✅ |
| S10 Mic check · S11 Room · S12 Review · S13 Analysing | `/session/*` | INT-02/07/11 (Realtime stage updates, retry card) | ✅ |
| S14 Report · S15 History · S16 Deck detail | `/reports/[id]`, `/history*` | INT-02 | ✅ |
| S17 Settings (+ Delete account) · S18 Limit · Blocked/paused | `/settings`, `/limit`, `/paused` | INT-05/06, Phase 3 INT-10 | ✅ |
| A1 Overview · A2 Students · A3 Student detail · A4 Ratings · A5 AI usage (3×3) · A6 Terms editor | `/admin/*` | INT-05 (A6 publish: Phase 3 spec 09 + v1.1) | ✅ |
| Phase 2 additions (Delete account, paused screen, AI failure/retry cards, PowerPoint hint, "Use Chrome" note, 10:00 cap) | see Q1 | MOCK journeys 2/6/8/9; INT-05 (paused), INT-10 (delete), INT-02/11 (AI failure card path) | ✅ (10:00 cap and Chrome note: MOCK only) |
| Filler-words note (Q4) | `features/reports/Report.tsx` | MOCK journey-2 (card + accordion); INT report page | ✅ |

## D. Non-functional
| Area | Verification | Result |
|---|---|---|
| RLS / isolation | INT-04 (tables, files, RPCs, functions, Realtime) | ✅ |
| Security headers / CSP on the deployed origin | deployed-site audit | ⏳ |
| Accessibility (axe) | MOCK a11y sweep (CI); deployed-site sweep | ✅ mock · ⏳ deployed |
| Performance (Lighthouse) | deployed site | ⏳ |
| Real devices / browsers | `device-matrix.md` | ⏳ |
