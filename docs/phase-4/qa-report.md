# Phase 4 QA report (running log — final numbers at release)

## Session 1 — 2026-10-15 (local app → hosted backend; deployed-site pass pending)
Setup: one Supabase project + one R2 bucket are production; **0 real users** existed throughout; test users `@mock2pitch.test` only; Edge Functions redeployed twice from the branch (`workflow_dispatch`) for the hardening below; app run locally (`next dev`, supabase mode).

### Integration results (Playwright, real Supabase + R2 + NVIDIA)
| Spec | Project | Result |
|---|---|---|
| 01 smoke | desktop, mobile | ✅ ✅ |
| 02 onboarding → practice → report → rate → retake | desktop | ✅ (5.1–5.4) |
| 03 server-side upload validation | desktop | ✅ (8/8) |
| 04 isolation / security (tables, files, RPCs, functions, Realtime) | desktop | ✅ (6/6) |
| 05 admin + block/unblock | desktop, mobile | ✅ ✅ |
| 06 daily limit, deep links | desktop, mobile | ✅ ✅ |
| 07 resilient uploads (expired image URL, aborted clip) incl. full practice flow | desktop (A), mobile (fresh user) | ✅ ✅ |
| 08 invalid audio rejected, no AI calls | desktop | ✅ |
| 09 policy republish | — | not run on production in Phase 4 (it would add a test policy version that only a confirmed DELETE can remove); final evidence = publishing **v1.1** at cut-over; Phase 3 run stands |
| 10 account deletion (rows, auth user, R2 URLs 404) | desktop | ✅ |
| 11 stuck-upload recovery (new) | desktop | ✅ (first run hit the report-model 503s → led to the retry change below; second run ✅) |

Mock-mode / unit suites after the changes: Vitest unit+frontend+functions+db = **401 passed, 4 skipped by design**; typecheck and ESLint clean; mock E2E journey 2 (desktop + mobile) green with the new filler note; full mock E2E + a11y + WebKit smoke run in CI on the PR.

### Defects found in Phase 4 and fixed
| # | Finding (evidence) | Fix | Test |
|---|---|---|---|
| 1 | A session left in `uploading_audio` (rejected clip, tab closed mid-upload) holds the one-analysis slot; the student's next submit fails with `analysis_in_progress` until the 1 h sweeper (reproduced Phase 3, spec 08) | `session-analyse` returns the slot (`in_progress`) when clip checks fail; `session-submit-init` releases the student's other `uploading_audio` sessions once their 10-min URLs have expired; sweeper uses the same helper | `tests/functions/session.test.ts` (3 new + 2 updated), live: spec 11 |
| 2 | Report model answered **503 to 9 of 13 first attempts** (fast rejects ≈ 250 ms, no credits, clearing within seconds). One same-key retry was not enough: spec 11's first run ended `ai_unavailable`. `ai_usage_log` ids 51–68 | Router retries the last usable key up to 4 times (1.5/3/6/10 s) before cooling it down; `Deps.sleep` injectable | `tests/unit/router.test.ts` (2 new/updated); live proof: id 75 = 503, id 76 = success 3 s later in one analyse call |
| 3 | Filler count wording (Parakeet drops "um/uh") | Q4 note on the report card and each slide's accordion | `e2e/journey-2-practice.spec.ts` |

Open observation (not fixed): the report model's 503 rate is a **launch risk** — even with retries a second NVIDIA key helps only if it points to a different deployment/account; students may still see "AI busy → Try again" on bad minutes. Slide reading also returned `invalid_output` 3 times in 24 h (billable) and one 502.

### AI credits used (from `ai_usage_log`, Phase 4 session 1 = ids 45–80)
| Purpose | Successful | Billable | Failed calls | Notes |
|---|---|---|---|---|
| slide_reading | 12 | 13 | 1 | budget 30 → **13 used** |
| speech_to_text | 8 | 8 | 0 | 46 s of audio |
| report_generation | 5 | 5 | 10 (503) | budget 8 complete analyses → **5 used** |

### Cleanup
All five test users removed via the real `account-delete` (every call `storage_cleanup: complete`; DEL removed by spec 10). Residue SQL: every table 0; `ai_usage_log` keeps 80 anonymised rows. R2: owner to confirm the bucket shows 0 objects (no R2 listing access from the sandbox).
