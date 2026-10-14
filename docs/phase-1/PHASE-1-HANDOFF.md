# Phase 1 handoff — Mock2Pitch backend

## A. Phase
**Phase 1 is complete and verified on the real stack (Supabase + Cloudflare R2 + NVIDIA), with the exceptions listed in §F "Not verifiable without the Phase 2 UI".** Everything below says what was executed, where, and what was not.

**Hosted environment (verified 2026-10-14):** project `mkglxcdtfimgmvxtddst` (Postgres 17.11) has all 8 migrations; 10 Edge Functions are `ACTIVE` (the 9 product functions + the operator-only `ops-selftest`), deployed by the GitHub workflow on every merge to `main`; cron job `maintenance-sweep` runs every 15 min and returns `200` from the handler; Vault holds `functions_base_url` and a real `internal_function_secret`; R2 bucket `mock2pitch-dev` exists; security advisors reviewed (`HOSTED-STATE.md`).

**Live self-test results (run inside the Supabase Edge Runtime through `ops-selftest`, details and numbers in `spikes.md`):**
| Area | Result |
|---|---|
| R2 | 7/7: signed `Content-Type` and `Content-Length` are enforced by real R2, GET, CORS for localhost allowed / foreign origin refused, prefix delete |
| Report model `nvidia/nemotron-3-ultra-550b-a55b` | exact id confirmed; p50 1.2 s on a small prompt; `json_object` accepted |
| Slide model | the planned `meta/llama-4-maverick-17b-128e-instruct` is **retired (HTTP 410)**; replaced by `meta/llama-3.2-11b-vision-instruct`: 3/3 valid JSON with the new prompt, p50 ≈ 8 s per slide; images up to 1.6 MB accepted |
| Speech-to-text (Parakeet, gRPC) | works in-process in the Edge Runtime after replacing the gRPC library channel (which never connects there) with a direct `node:http2` call: p50 1.7 s for a 6 s clip; 3 of 4 spoken fillers kept in the transcript |
| Full pipeline with a synthetic user | all 7 steps pass: user → daily-session consumed → 2 slides read → clip transcribed → report (overall 22 for a deliberately short clip, formula verified) → audio deleted → usage log → complete cleanup (0 rows, 0 R2 objects left) |

## B. Completed
- Repo scaffold: Next.js 16 shell (env validation, Supabase clients, secret-protected internal transcribe route), `supabase/` config, shared pure-TS modules importable from both Deno and Vitest, `.gitignore`, `.env.example`.
- **Database** (8 migrations): 14 public tables + `private` helpers, constraints, race-free "one in-flight deck / one analysing session" indexes, RLS everywhere, column-level grants, owner allow-list + sign-up trigger, 10 student RPCs/views, 10 admin RPCs, 7 service-role functions, Realtime publication, 15-minute cron job (guarded).
- **Edge Functions** (9): `deck-upload-init`, `deck-upload-complete`, `deck-process`, `asset-urls`, `session-submit-init`, `session-analyse`, `account-delete`, `admin-ai-keys`, `maintenance-sweep`.
- **R2**: SigV4 presigned PUT/GET, server-side HEAD/GET/DELETE/list/prefix-delete, server-built keys, CORS file.
- **AI**: key router (3 purposes × 3 keys), chat transport, Riva gRPC client (direct HTTP/2, embedded descriptor from the vendored official protos), chunking/merging, prompts, Zod output validation, scoring `v1`.
- **Operator self-test** (`ops-selftest`, internal secret only): live R2 / NVIDIA / pipeline checks, invoked from SQL. Safe to keep; delete the function when Phase 2 begins if you prefer.
- Dev seed, committed fixtures, generated DB types, NVIDIA spike script, opt-in live tests, bundle scanner, docs (§12).

## C. Verified (by area) — all executed
- **Scoring/validators/router/schemas/env** (unit): boundaries, filler regex word-boundaries, WAV/PDF/JPEG checks, every router branch (429/401/400/5xx/timeout/cooldown/RPM/credits/empty slots/invalid output), Zod clamping and injection guards.
- **Database on real PostgreSQL 16.15**: migrations apply from scratch; owner promotion (case-insensitive, verified-email only, later confirmation, `sync_owner_role`); clients cannot change `role/is_blocked/email/...`; IST boundary; limit 5/6th rejected; **8 concurrent connections at count 4 → exactly 1 success**; attempt 1 free / retake charged / restart not double-charged; policy gating incl. in-progress exception; RLS matrix for anon, A, B, blocked, admin (no admin access to content tables; admin cannot practise); admin RPCs return summary fields only; structural privilege/`search_path`/FK-index audit; seed integrity.
- **Edge Function handlers** against real Postgres + a fake S3 that re-computes SigV4 + a scriptable fake NVIDIA: all upload/processing/analysis paths in §10.4 including 10 vs 11 pages, encrypted/corrupt/renamed files, size mismatch, AI-busy → retry without duplicates, key fallback, resume at each stage, invalid report JSON → one repair, chunked ASR with offset-corrected timestamps, audio deleted after success and kept after failure, concurrent analysis rejection, account deletion with partial R2 failure finished by the sweeper, sweeper rules, masked keys, CORS, log hygiene.
- **Real Deno 2.9.6**: all entrypoints `deno check`; real processes serve CORS/401/403/misconfigured responses; the Riva client works under Deno against a local mock Riva server.
- **Live (hosted) — see §A and `spikes.md`:** R2, NVIDIA slide/report/speech models, and the full pipeline with a synthetic user.
- **Build/quality**: `tsc --noEmit` strict clean; ESLint clean; `next build` OK; client bundle scan clean; `npm audit` 0 vulnerabilities; secret scan of tracked files and full git history clean.

## D. Test results (latest full run: 246 tests, 242 passed, 0 failed, 4 skipped by design)
| Suite | Command | Result | Covers |
|---|---|---|---|
| unit | `npm run test:unit` | 70 pass | scoring, files, router, schemas (incl. tolerant slide output), riva client over HTTP/2 + chunking, transcribe route, fixtures, env |
| db | `npm run test:db` | 90 pass | migrations, auth/roles, limits/IST/race, policy, constraints/cascades, RLS matrix, security audit, seed |
| functions | `npm run test:functions` | 68 pass | deck, session, admin keys, account deletion, sweeper, `ops-selftest`, Deno runtime, logging |
| r2 | `npm run test:r2` | 13 pass | SigV4 presign vs independent verifier, expiry, tamper, prefix delete, CORS file |
| live | `RUN_LIVE_AI_TESTS=1 npm run test:live-ai` | **4 skipped** | the sandbox cannot reach NVIDIA; the equivalent live checks ran inside the hosted Edge Runtime via `ops-selftest` (§A) |
Prerequisite: a local PostgreSQL ≥ 15 (`scripts/pg-test-server.sh`). The DB/function tests use a Supabase stand-in, not the real stack. `tsc --noEmit` and ESLint are clean.
## E. Security review
`docs/phase-1/security-review.md`. Highlights: one real bug found and fixed (citext equality under empty `search_path`); anon can execute only a pure date helper; `svc_*` are service-role only; no admin SELECT on content; open residual risks listed there. Hosted advisors were **not** run.

## F. Issues / open questions (owner decisions needed)
1. **Design handoff missing** from the repo. Legal text, ParkSense sample and field names could not be taken from it (see `existing-state.md`).
2. **Legal text edits to review.** `policy_versions v1.0` is a *draft authored from §1*: PDF-only, ≤10 slides/5 MB, 5 sessions/day IST, AI feedback disclaimer, audio sent to an AI speech service and deleted once the report is generated, "only you can see your reports; the owner sees aggregate usage, your profile details and the star ratings you give". It is not the handoff's `TERMS0`/`PRIV0`. Publish the approved text as `v1.1` (owner-setup §7).
3. **Scoring constants are my defaults, not owner-specified:** timing full band ±5 % → 0 at ±50 %; filler penalty 15 pts per filler/min (0.5-min floor); filler regex list. Tunable in `constants.ts` (`scoring_version` is stored per report).
4. **Slide-image rule (measured):** max 1,000,000 bytes / 1280 px / quality 0.8→0.5 / min width 800. NVIDIA accepted inline images up to 1.6 MB, so the 180 KB assumption was wrong and the asset-upload path is not needed. Phase 2 reads these numbers from `deck-upload-complete → rules`.
5. **Admin sees deck titles** in attempts and ratings lists (the design shows them). Titles are user text (default = file name). Say if you would rather show "Deck 1".
6. **"Sessions per day" chart** counts submitted attempts per IST day; "practice sessions" in the overview counts submitted attempts, not daily-limit consumptions.
7. **R2 lifecycle safety-net is not configurable** with the prescribed key layout (literal prefixes only). Proposed: audio under its own top-level prefix. Sweeper covers 24 h meanwhile.
8. **Presigned image PUT cannot cap size up front** (size unknown at signing); enforced after upload.
9. **`verify_jwt`**: kept `true` per spec for user-only functions; if the hosted project uses asymmetric JWT keys and the gateway rejects tokens, flip to `false` (code already verifies).
10. **ASR option (decided):** Option A, in-process from the Edge Function, is verified live; leave `INTERNAL_TRANSCRIBE_URL` unset. The Next.js route (Option B) stays in the repo as a fallback only. A **human-recorded** clip has not been transcribed (the test clip is text-to-speech): record one in Phase 2 and check how many fillers survive; the model dropped 1 of 4 in the synthetic clip.
11. `NVIDIA_KEY_DEFAULT_CREDIT_LIMIT` is validated but slots are seeded with 1000 by migration (change with `admin_set_credit_limit`).
12. A restarted unsubmitted attempt reuses its attempt number and is not charged twice (my reading of "retake" fairness); an unsubmitted attempt is abandoned after 24 h.
13. `types/database.ts` comes from `scripts/gen-types.mjs` (no Docker). It approximates `supabase gen types`; table-function columns are typed nullable. Re-generate with `npm run gen:types:cli` when Docker is available.
14. The hosted project is "Mock2Pitch" (`mkglxcdtfimgmvxtddst`); see `HOSTED-STATE.md`.
15. **Slide model changed.** Maverick was retired by NVIDIA (HTTP 410). The Supabase secret `NVIDIA_SLIDE_MODEL` should be `meta/llama-3.2-11b-vision-instruct` (the code default and `.env.example` already are). Report time: the full report call is the slow step (≈ 30 s for a one-slide session), so analysis takes roughly 30–60 s; the UI must show progress via Realtime.
16. **Only one NVIDIA key per purpose is configured** (primary). Fallback slots 1–2 exist and are tested with fakes, but have no real key; add keys in Supabase secrets when available.
17. **Add the Netlify origin to the R2 CORS policy** (`infra/r2-cors.json`) when the site exists; only `http://localhost:3000` is verified.

### Not verifiable without the Phase 2 UI (nothing the owner needs to do now)
- Google sign-in end to end and owner promotion to `admin` on first Google login (the allow-list holds `dubbakasathwik@gmail.com`; configure the Google provider first — `owner-setup.md`).
- Browser uploads through pdf.js / MediaRecorder, and Realtime events arriving in a browser.
- Filler retention on a human recording.

Previously open items R1 (Vault secret), R2 (deploy `ops-selftest`) and R3 (run the self-test) are **done**.

## G. Files / architecture
`supabase/migrations/*.sql` · `supabase/functions/<name>/index.ts` (Deno wiring only) · `supabase/functions/_shared/{constants,scoring,files,audio,schemas,http,env,r2,deps,deno-deps}.ts` · `_shared/handlers/*` (the logic) · `_shared/ai/*` · `_shared/nvidia/{router,chat}.ts` · `_shared/riva/` (client + vendored protos) · `_shared/prompts/*` · `app/api/internal/transcribe/route.ts` · `lib/env.ts` · `infra/r2-cors.json` · `tests/**` · `docs/phase-1/*`. Architecture and decisions: `architecture.md`.

## H. Environment (names only)
| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` | Netlify (public), local `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_TRANSCRIBE_SECRET` | Netlify (server-only), local — never `NEXT_PUBLIC_` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | injected into Edge Functions by Supabase |
| `INTERNAL_FUNCTION_SECRET`, `APP_ALLOWED_ORIGINS`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `NVIDIA_SLIDE_MODEL`, `NVIDIA_REPORT_MODEL`, `NVIDIA_ASR_FUNCTION_ID`, `NVIDIA_ASR_MODEL_LABEL`, `NVIDIA_{SLIDE,ASR,REPORT}_KEY_{PRIMARY,FALLBACK_1,FALLBACK_2}`, `NVIDIA_KEY_RPM_SOFT_LIMIT`, `NVIDIA_KEY_DEFAULT_CREDIT_LIMIT`, optional `INTERNAL_TRANSCRIBE_URL` | Supabase secrets (`supabase secrets set --env-file`) |
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET` | Supabase Auth provider settings / local `config.toml` env |
| Vault: `functions_base_url`, `internal_function_secret` | Supabase Vault (cron) |
| `RUN_LIVE_AI_TESTS`, `TEST_DATABASE_URL` | local only |

## I. Test accounts — LOCAL DEVELOPMENT ONLY (`supabase db reset` loads `supabase/seed.sql`)
Never use these against a hosted project; hosted sign-in is Google-only.
| Email | Password | Role / state |
|---|---|---|
| owner@mock2pitch.test | `_VG-3Tc2si0lSSvY` | admin (local allow-list) |
| student.a@mock2pitch.test | `HA6fRWOv-1Kfqmlr` | profile + policy done; ParkSense deck (pinned), attempts 62 → 74, rated 4★ |
| student.b@mock2pitch.test | `cbuApdcQC1p3LP60` | profile + policy done; one report (83), rated 5★ |
| student.blocked@mock2pitch.test | `BZrnhaY4Qhra8XVf` | blocked |
| student.new@mock2pitch.test | `JIJWAwG6uQd7wCX_` | no profile, no policy acceptance |
Seed validity was tested on the PG 16 stand-in; **it has not been run through real GoTrue** (identity rows follow the common pattern but are unproven).

## J. Backend summary
- **Migrations**: `…0001` core schema · `…0002` auth/roles/RLS · `…0003` policy+practice+views+realtime · `…0004` admin RPCs · `…0005` service functions + 9 key slots · `…0006` policy v1.0 draft · `…0007` cron · `…0008` account-deletion bookkeeping.
- **Realtime**: `decks`, `practice_sessions` (own rows via RLS).
- **Cron**: `maintenance-sweep` every 15 min (`pg_cron`+`pg_net`+Vault).
- Tables, RLS, RPCs, errors: `supabase.md`. Contracts: `api-contracts.md`.

## K. R2 summary
Private bucket per environment; keys `users/{uid}/decks/{deck}/source.pdf`, `…/slides/{i}.jpg`, `users/{uid}/sessions/{sess}/audio/{i}.wav`; presigned PUT 5/10 min (type signed; length signed for PDF/audio), GET 10 min; server verifies size/signature/page count; audio deleted after report, swept at 24 h; account deletion removes the whole `users/{uid}/` prefix with pagination. Limitations and the lifecycle-rule problem: `r2.md`.

## L. §15 checklist (✅ verified on the real stack · ◐ verified only against a stand-in · ⛔ not done / not verifiable yet)
**Repository & environment** — ✅ existing state documented, nothing overwritten · ✅ `.gitignore`/`.env.example`, Zod env · ✅ no secrets in files/history.
**Spikes** — ✅ NVIDIA models live (report model confirmed; slide model replaced after Maverick returned 410; 90B too slow; gemma/phi listed but 404) · ✅ vision inline limit measured (≥ 1.6 MB OK; rule set to 1 MB) · ✅ gRPC works in the Edge Runtime (needed the HTTP/2 client replacement) · ✅ real transcription · ◐ filler retention measured on a synthetic clip only (3/4); a human recording is still open.
**Database** — ✅ migrations applied to the hosted PG 17 project and verified (14 tables, RLS on all, definer functions pinned, privileges, Realtime tables, cron job running) · ✅ real Auth admin API + `handle_new_user` trigger + daily-session consumption on PG 17 (pipeline check) · ◐ test suites (race, IST, policy, constraints, RPCs) run on PG 16 (⛔ `supabase db reset` not run: no Docker images).
**RLS** — ◐ RLS matrix for anon/A/B/blocked/admin against the stand-in · ✅ Supabase advisors run on the hosted project: 0 errors; 3 INFO (RLS without policy on the three intentionally locked tables), 17 WARN (intentional `SECURITY DEFINER` RPCs, each checks `auth.uid()`/admin), 26 INFO unused indexes.
**R2** — ✅ private bucket · ✅ signed Content-Type and Content-Length enforced by real R2 · ✅ CORS allow/deny · ✅ presigned PUT/GET, delete, prefix delete · ⛔ lifecycle rule not expressible with the key layout (sweeper covers it) · ◐ PDF/JPEG/WAV server validation, metadata consistency, sweeper (fake S3).
**AI pipeline** — ✅ deck processing and session analysis on the real stack (synthetic user, one key per purpose) · ✅ usage log without prompts/keys · ✅ audio deleted after the report · ◐ key fallback/cooldown/credit paths (fake NVIDIA; only primary keys exist live) · ⛔ Realtime events not observed in a browser.
**Account & admin** — ◐ account deletion (fake R2; the self-test cleanup exercised real cascade + R2 prefix delete) · ◐ block/unblock, ratings, overview, sessions/day, AI usage, policy publish · ⛔ owner promotion via real Google login.
**Security & quality** — ✅ bundle clean (shell only; re-scan in Phase 2/3) · ✅ safe errors, logs tested · ✅ TS strict, lint, all suites run and re-run after fixes · ✅ docs · ◐ DB types generated by script.

## M. Next phase
Phase 2 builds the UI from the design handoff (still missing from the repo) against `api-contracts.md`. Before or during it: configure the Google provider and sign in as the owner (verifies admin promotion), add the Netlify origin to R2 CORS, set `NVIDIA_SLIDE_MODEL` to the 11B model in Supabase secrets if not done, record a human clip to check fillers, and watch Realtime in a browser.

## N. Phase 2 handoff
- **Contract and types:** `docs/phase-1/api-contracts.md`, `types/database.ts`.
- **Error → screen mapping:** table at the top of `api-contracts.md` (`daily_limit_reached` → S18; `policy_not_accepted` → S3 "updated"; `profile_incomplete` → S4; `blocked`; `is_admin`; `too_many_pages` with `page_count` → "That deck has N slides"; `not_pdf`/`too_large` under the dropzone; `ai_unavailable`/`AI_BUSY` retry states). Realtime stage strings for S7/S13 are in the same file.
- **Client responsibilities defined by this backend:**
  - Render each PDF page with **pdf.js** to JPEG using `rules` from `deck-upload-complete` (`max_width`, `jpeg_quality` → `min_jpeg_quality`, `min_width`, `max_bytes`; lower quality then width until the file fits) and PUT with `Content-Type: image/jpeg`.
  - Record with MediaRecorder, convert to **16 kHz mono 16-bit PCM WAV** (the server rejects anything else with `audio_invalid` + `reason`), declare exact byte sizes in `session-submit-init`, upload all clips at once with `Content-Type: audio/wav`, then call `session-analyse`.
  - Never send `Content-Length` yourself; the body size must equal the declared size.
  - Subscribe to Realtime on `decks` / `practice_sessions`; show "Use Chrome for the best results" (non-blocking) and "Save as PDF" for PowerPoint users; enforce 5 MB / 10 slides / 1–20 min in the UI too (the server is authoritative).
  - Do not gate the admin behind the policy screen (admins cannot accept policies).
- **Design mapping notes:** the admin AI-usage screen should show **3 service cards** (slide reading, speech-to-text, report generation), each listing its **3 masked keys** with used/remaining and a per-day chart per purpose (data: `admin_ai_usage` + `admin-ai-keys`) — **confirm with the owner before building**, since the prototype shows 4 cards with one key each. Pacing (WPM) is an info card, not a sub-score; the overall score is the 4-part weighted score.
