# Phase 3 handoff — Mock2Pitch frontend ↔ Supabase + Cloudflare R2 + NVIDIA

## A. Phase
**Phase 3 (integration) is built and proven on the real stack from a local app** (`NEXT_PUBLIC_DATA_MODE=supabase`, `next dev` on :3000 →
hosted Supabase `mkglxcdtfimgmvxtddst`, R2 bucket `mock2pitch-dev`, NVIDIA). Not done, and **owner-dependent / deferred by decision**:
Google sign-in with a real Google account (needs the owner's OAuth client), the Netlify deployment and everything that must run on the deployed
origin (CORS, CSP headers, Lighthouse), real-device recording and a human filler clip. Each is listed with exact steps in §F and `docs/phase-3/`.

**Environment decision (owner, 2026-10-15): one Supabase project and one R2 bucket are production.** There is no staging. Phase 4 therefore has
no production-environment task. All test traffic used `@mock2pitch.test` users and was cleaned up (residue 0, §C).

## B. Completed
* **Supabase/R2 adapter** behind the unchanged `DataPort` (`lib/data/supabase/`): transport (fresh token, refresh when < 60 s left, one refresh + retry on `not_authenticated`, Edge Function envelope), error normalisation (Postgres/PostgREST/function/auth → the closed `AppError` code set), Zod schemas for every response (dev throws on drift; prod → `unknown` + code-only log), Realtime `postgres_changes` helpers, masked AI-key handling, `account.delete` + local sign-out. The UI still only talks to `DataPort`.
* **Auth:** `@supabase/ssr` cookie sessions (`lib/supabase/{browser,server}.ts`), `proxy.ts` (Next 16 replacement of middleware) refreshing sessions, `app/auth/callback/route.ts` (PKCE code exchange, role-based landing, validated `next`), `signInWithGoogle`, cookie hint (`auth.peek`) so route data prefetches in parallel with the gate.
* **Resilience in the UI:** upload resumes a deck without consuming a second session; expired image URLs are re-issued and retried once; a failed clip upload re-sends only that clip; "Try again" after an AI-busy failure waits 30 s.
* **Backend fixes** that integration proved necessary (§J): Google-only sign-up hook + DB guard, `session-submit-init` re-init, router same-key retry.
* **Infra:** `.github/workflows/ci.yml`, `netlify.toml`, `scripts/check-prod-bundle.mjs` (supabase build has no mock backend), integration test harness (`e2e-int/`, `playwright.integration.config.ts`, `scripts/integration/*`).
* **Docs:** `docs/phase-3/{integration,existing-state,security-review,fillers,device-checks,owner-steps}.md`, README, `docs/phase-1/{HOSTED-STATE,owner-setup}.md` updates.

## C. Verified (what / where / how)
| Area | How | Result |
|---|---|---|
| Real-stack journeys 5.1–5.10, desktop | Playwright specs `e2e-int/01…10` against the local app + hosted backend | pass (details per flow: `docs/phase-3/integration.md` §2) |
| Real-stack, mobile (Pixel 7, 390×844) | specs 01, 05, 06, 07 (07 = full practice flow incl. injected R2 failures) | pass |
| DB/R2 state | RLS reads as the user, SQL as service, presigned-URL status codes | matches expectations after every flow |
| Failure paths | invalid PDFs/audio, expired URLs, aborted PUTs, AI 503, daily limit, blocked user, policy republish, deleted account | behave as designed (§2 of integration.md) |
| Isolation | spec 04 (tables, files, RPCs, functions, Realtime) | pass |
| Mock-mode regression | `npm run test:e2e` / `:mobile` / `test:a11y` | 23 ✓ (1 skipped) / 23 ✓ / sweep ✓ |
| Vitest | unit 73 + frontend 141 = 214; functions + db 170 (local PostgreSQL 16) | all pass |
| `tsc --noEmit`, `eslint .` | | clean |
| Supabase-mode production build | `NEXT_PUBLIC_DATA_MODE=supabase npm run build`, `scan:bundle`, `check-prod-bundle` | 32 routes; bundle clean; no mock backend |
| Cleanup | `scripts/integration/cleanup-via-api.mjs` + residue SQL | **0** rows in every table except 44 anonymised `ai_usage_log` rows; one harmless test policy version left (§F.1) |
| CI | `ci.yml` on PR #13, run 20 (head `9fd5905`) | all 6 jobs green: quality (typecheck, lint, 397 tests passed + 4 skipped by design), both builds + bundle guards, mock E2E desktop/mobile/a11y, WebKit smoke (first WebKit evidence: sign-in → Terms → profile → dashboard → upload → prepare) |

## D. Test results (numbers)
* Integration desktop: specs 01, 03, 04, 05, 06 → 22 tests pass (two runs, after B's seed date fix); 02, 07 pass (earlier runs; 07 re-run on mobile), 08, 09, 10 pass.
* Integration mobile: 01 (2), 05 (3), 06 (3), 07 (1) pass.
* AI credits (from `ai_usage_log`, all history): slide_reading 22 ok / 25 billable / 5 failed (161 171 + 3 421 tokens); speech_to_text 8 ok / 1 failed (45 s audio); report_generation 5 ok / 3 failed (3 015 + 4 304 tokens). **Phase 3 complete analyses: 4** (≤ 10 allowed); invalid-input tests used 0 credits.
* Latency: slide reading ≈ 9.9 s per slide (3.8–18.4 s); ASR ≈ 0.9 s per 5.6 s clip; report 16–34 s; submit → report 29 s / 53 s (no real-time stage-string or latency timeline was persisted from a fresh run; the stage strings are asserted by spec 02 and shown by the UI).

## E. Security review
`docs/phase-3/security-review.md`: 15 controls re-tested live; 6 findings (1 medium fixed: public email sign-up possible before the hook is enabled → DB guard). Residual items are owner steps (hook, Email off, JWT keys).

## F. Issues / open questions (owner action needed)
1. **Test policy version `v1.0.1`** remains in `policy_versions` (same text as v1.0). The Supabase tool holds DELETEs for confirmation and timed out. Remove it with `delete from policy_versions where version_label = 'v1.0.1' and note = 'integration test (same text)';` or leave it. Both are safe; publish your real `v1.1` after.
2. **Dashboard steps not yet done** (`docs/phase-3/owner-steps.md`): Google OAuth client + provider (A, B1); enable the Before-User-Created hook (B3); URL configuration (B4); `APP_ALLOWED_ORIGINS` incl. `http://localhost:3000` and `NVIDIA_SLIDE_MODEL` (B5); answer the JWT-keys question (legacy HS256 secret still in use; works today).
3. **Turn the Email provider off before launch** (it was enabled for tests; the DB guard and hook keep sign-up Google-only anyway).
4. **Netlify + R2 CORS** (steps C, D): deferred until development testing is finished. After deploy: set the real origin in `infra/r2-cors.json`, run `INTEGRATION_BASE_URL=https://<site> npm run test:integration` (re-provision test users first: `node scripts/integration/provision-test-users.mjs`), run Lighthouse, then clean up again.
5. **Report model reliability:** `nvidia/nemotron-3-ultra-550b-a55b` returned 503 in 3 of 8 report calls. Configure a **fallback key** for report analysis (Admin → AI usage) — with two usable keys the router rotates instead of waiting.
6. **Parakeet drops "um/uh"** (`fillers.md`); lexical fillers work. Decide how to word the feature.
7. **Device checks and a human filler clip** — checklist in `device-checks.md`.
8. R2 emptiness could not be listed from the sandbox (no R2 credentials): look at R2 → `mock2pitch-dev` → Objects (expect none).
9. Phase 2 (and this phase) are on `claude/sleepy-rubin-mm8mb1` / PR #13; GitHub `main` still holds only Phase 1 until the owner merges.

## G. Files / architecture
```
lib/data/supabase/{adapter,transport,errors,schemas,index}.ts   the adapter (one DataPort implementation)
lib/data/index.ts            chooses mock or supabase from the inlined NEXT_PUBLIC_DATA_MODE (supabase builds drop the mock)
lib/supabase/{browser,server}.ts, proxy.ts, app/auth/callback/route.ts   cookie sessions + OAuth landing
lib/env.public.ts            browser-safe env split
features/upload/useUploadFlow.ts, features/practice/{useSubmitFlow,Analysing}.tsx, features/errors/useRetryDelay.ts, features/guards/prefetch.ts
e2e-int/                     integration specs 01–10 + support (api, session, realtime, console), README
scripts/integration/         provision-test-users.mjs, cleanup-via-api.mjs
supabase/migrations/…0009, …0010; supabase/functions/_shared/{handlers/session-submit-init.ts, nvidia/router.ts, constants.ts}
.github/workflows/ci.yml, netlify.toml, scripts/check-prod-bundle.mjs
```

## H. Environment (names only)
Browser: `NEXT_PUBLIC_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD` (previews only).
Edge Function secrets: unchanged from Phase 1 plus `APP_ALLOWED_ORIGINS` (must include `http://localhost:3000` for local runs) and `NVIDIA_SLIDE_MODEL`.
Integration tests: `IT_USER_{NEW,A,B,DEL,ADMIN}_{EMAIL,PASSWORD}` (git-ignored `.env.integration.local`), optional `INTEGRATION_BASE_URL`, `IT_07_USER`.
**Never** set `SUPABASE_SERVICE_ROLE_KEY` or `INTERNAL_TRANSCRIBE_SECRET` in Netlify.

## I. Test accounts
None exist now (all deleted). `node scripts/integration/provision-test-users.mjs` prints the SQL that recreates them (ids `00000000-0000-4000-8000-0000000017NN`) and writes new random passwords. Student B's five seeded `usage_events` are described in `e2e-int/README.md`.

## J. Backend changes in Phase 3 (all additive; no RLS weakened; no data destroyed)
1. Migration `20261015000009_auth_hook_google_only.sql` — `hook_before_user_created`.
2. Migration `20261015000010_auth_users_google_only_guard.sql` — trigger guard on `auth.users`.
3. `session-submit-init` — reuse rows on re-init, keep uploaded clips (test: `tests/functions/session.test.ts`).
4. `nvidia/router.ts` + `SAME_KEY_RETRY_DELAY_MS = 1500` — one same-key retry for a transient 5xx on the last usable key (3 tests in `tests/unit/router.test.ts`; live proof in `integration.md` §5).
Deployed with `deploy-supabase-functions.yml` (workflow_dispatch from this branch); functions are version 11.

## K. R2 summary (client behaviour proven live)
Presigned PUT binds Content-Type and Content-Length; a wrong type or short body is refused by R2; expired/refused image PUT → `deck-upload-complete` re-issues URLs and the UI retries once; clip PUT failure → only that clip is re-sent after `session-submit-init` is called again; GET URLs are 10 minutes and 404 after account deletion; audio is deleted after analysis. **CORS from the deployed origin is untested** (Netlify deferred); localhost PUTs worked from the sandbox browser.

## L. Definition of Done — status
| Item | Status |
|---|---|
| UI uses only `DataPort`; mock and Supabase adapters selectable by env; supabase build has no mock | ✅ bundle check |
| Every journey proven on the real stack with DB/R2 verification | ✅ with test-password sessions; ⚠ Google sign-in itself not exercised (owner) |
| Failure paths behave as designed | ✅ |
| RLS/isolation re-tested from a real client | ✅ |
| AI credits reported per purpose; ≤ 10 complete analyses | ✅ (4) |
| All test users/objects removed (residue 0) | ✅ (one harmless policy version, §F.1; R2 owner check, §F.8) |
| Docs and handoff | ✅ |
| Deployed site, CORS, Lighthouse on deployed site | ⏳ deferred by owner decision |
| Real-device recording, human filler clip | ⏳ owner (checklist) |
| CI green on the PR | ✅ run 20 |

## M. Next phase (Phase 4)
No production-environment task (single environment). Candidates: (1) deploy to Netlify and run the deployed-origin checks (F.4); (2) real Google sign-in verification, publish the OAuth consent screen, Email provider off; (3) second report key + monitoring of AI 503/latency (`ai_usage_log`); (4) let a user abandon a session stuck in `uploading_audio`; (5) decide JWT signing-key migration; (6) filler wording / ASR options; (7) real-device fixes from `device-checks.md`.

## N. Phase 4 handoff — how to run what exists
```bash
node scripts/integration/provision-test-users.mjs > /tmp/p.sql   # run the SQL in the Supabase SQL editor; passwords go to .env.integration.local
NODE_USE_ENV_PROXY=1 npm run test:integration -- --project=integration-desktop   # local app on :3000, hosted backend
INTEGRATION_BASE_URL=https://<site>.netlify.app npm run test:integration           # deployed site
update profiles set role = 'student' where email = 'it.admin@mock2pitch.test';     -- then:
node scripts/integration/cleanup-via-api.mjs                                       # deletes every test user via account-delete
```
Order matters for AI cost: run 02 (onboarding + one analysis) first, 07 and 10 spend one upload each; 08 reuses A's deck. Specs 03 and 06 conflict on B's usage dates (`e2e-int/README.md`).
