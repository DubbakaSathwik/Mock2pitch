# Phase 1 handoff — Mock2Pitch backend

## A. Phase
**Phase 1 is code-complete and tested to the limit of this environment, but it is NOT "done" by the §15 definition.** Everything that needs the real Supabase stack (Docker), Cloudflare R2, NVIDIA, or Google OAuth is **blocked / unverified** and listed explicitly in §L. Nothing was reported as passing that was not executed.

## B. Completed
- Repo scaffold: Next.js 16 shell (env validation, Supabase clients, secret-protected internal transcribe route), `supabase/` config, shared pure-TS modules importable from both Deno and Vitest, `.gitignore`, `.env.example`.
- **Database** (8 migrations): 14 public tables + `private` helpers, constraints, race-free "one in-flight deck / one analysing session" indexes, RLS everywhere, column-level grants, owner allow-list + sign-up trigger, 10 student RPCs/views, 10 admin RPCs, 7 service-role functions, Realtime publication, 15-minute cron job (guarded).
- **Edge Functions** (9): `deck-upload-init`, `deck-upload-complete`, `deck-process`, `asset-urls`, `session-submit-init`, `session-analyse`, `account-delete`, `admin-ai-keys`, `maintenance-sweep`.
- **R2**: SigV4 presigned PUT/GET, server-side HEAD/GET/DELETE/list/prefix-delete, server-built keys, CORS file.
- **AI**: key router (3 purposes × 3 keys), chat transport, Riva gRPC client (vendored official protos), chunking/merging, prompts, Zod output validation, scoring `v1`.
- Dev seed, committed fixtures, generated DB types, NVIDIA spike script, opt-in live tests, bundle scanner, docs (§12).

## C. Verified (by area) — all executed
- **Scoring/validators/router/schemas/env** (unit): boundaries, filler regex word-boundaries, WAV/PDF/JPEG checks, every router branch (429/401/400/5xx/timeout/cooldown/RPM/credits/empty slots/invalid output), Zod clamping and injection guards.
- **Database on real PostgreSQL 16.15**: migrations apply from scratch; owner promotion (case-insensitive, verified-email only, later confirmation, `sync_owner_role`); clients cannot change `role/is_blocked/email/...`; IST boundary; limit 5/6th rejected; **8 concurrent connections at count 4 → exactly 1 success**; attempt 1 free / retake charged / restart not double-charged; policy gating incl. in-progress exception; RLS matrix for anon, A, B, blocked, admin (no admin access to content tables; admin cannot practise); admin RPCs return summary fields only; structural privilege/`search_path`/FK-index audit; seed integrity.
- **Edge Function handlers** against real Postgres + a fake S3 that re-computes SigV4 + a scriptable fake NVIDIA: all upload/processing/analysis paths in §10.4 including 10 vs 11 pages, encrypted/corrupt/renamed files, size mismatch, AI-busy → retry without duplicates, key fallback, resume at each stage, invalid report JSON → one repair, chunked ASR with offset-corrected timestamps, audio deleted after success and kept after failure, concurrent analysis rejection, account deletion with partial R2 failure finished by the sweeper, sweeper rules, masked keys, CORS, log hygiene.
- **Real Deno 2.9.6**: all 9 entrypoints `deno check`; real processes serve CORS/401/403/misconfigured responses; `@grpc/grpc-js` + Riva protos work under Deno.
- **Build/quality**: `tsc --noEmit` strict clean; ESLint clean; `next build` OK; client bundle scan clean; `npm audit` 0 vulnerabilities; secret scan of tracked files and full git history clean.

## D. Test results (latest full run: 231 tests, 227 passed, 0 failed, 4 skipped by design)
| Suite | Command | Result | Covers |
|---|---|---|---|
| unit | `npm run test:unit` | 66 pass | scoring, files, router, schemas, riva client + chunking, transcribe route, fixtures, env |
| db | `npm run test:db` | 90 pass | migrations, auth/roles, limits/IST/race, policy, constraints/cascades, RLS matrix, security audit, seed |
| functions | `npm run test:functions` | 57 pass | deck, session, admin keys, account deletion, sweeper, Deno runtime, logging |
| r2 | `npm run test:r2` | 13 pass | SigV4 presign vs independent verifier, expiry, tamper, prefix delete, CORS file |
| live | `RUN_LIVE_AI_TESTS=1 npm run test:live-ai` | 1 pass, **4 skipped** | **never run** (no network/keys) |
Prerequisite: a local PostgreSQL ≥ 15 (`scripts/pg-test-server.sh`). The DB/function tests use a Supabase stand-in, not the real stack.

## E. Security review
`docs/phase-1/security-review.md`. Highlights: one real bug found and fixed (citext equality under empty `search_path`); anon can execute only a pure date helper; `svc_*` are service-role only; no admin SELECT on content; open residual risks listed there. Hosted advisors were **not** run.

## F. Issues / open questions (owner decisions needed)
1. **Design handoff missing** from the repo. Legal text, ParkSense sample and field names could not be taken from it (see `existing-state.md`).
2. **Legal text edits to review.** `policy_versions v1.0` is a *draft authored from §1*: PDF-only, ≤10 slides/5 MB, 5 sessions/day IST, AI feedback disclaimer, audio sent to an AI speech service and deleted once the report is generated, "only you can see your reports; the owner sees aggregate usage, your profile details and the star ratings you give". It is not the handoff's `TERMS0`/`PRIV0`. Publish the approved text as `v1.1` (owner-setup §7).
3. **Scoring constants are my defaults, not owner-specified:** timing full band ±5 % → 0 at ±50 %; filler penalty 15 pts per filler/min (0.5-min floor); filler regex list. Tunable in `constants.ts` (`scoring_version` is stored per report).
4. **Slide-image size rule is provisional** (180 KB / 1280 px / quality 0.8→0.5 / min width 800). NVIDIA's real inline limit is unverified; the asset-upload path is not built.
5. **Admin sees deck titles** in attempts and ratings lists (the design shows them). Titles are user text (default = file name). Say if you would rather show "Deck 1".
6. **"Sessions per day" chart** counts submitted attempts per IST day; "practice sessions" in the overview counts submitted attempts, not daily-limit consumptions.
7. **R2 lifecycle safety-net is not configurable** with the prescribed key layout (literal prefixes only). Proposed: audio under its own top-level prefix. Sweeper covers 24 h meanwhile.
8. **Presigned image PUT cannot cap size up front** (size unknown at signing); enforced after upload.
9. **`verify_jwt`**: kept `true` per spec for user-only functions; if the hosted project uses asymmetric JWT keys and the gateway rejects tokens, flip to `false` (code already verifies).
10. **ASR option**: default in code is in-process gRPC (Option A) when `INTERNAL_TRANSCRIBE_URL` is unset; I recommend starting with Option B (set that URL + secret) until a real clip is transcribed inside the Edge Runtime.
11. `NVIDIA_KEY_DEFAULT_CREDIT_LIMIT` is validated but slots are seeded with 1000 by migration (change with `admin_set_credit_limit`).
12. A restarted unsubmitted attempt reuses its attempt number and is not charged twice (my reading of "retake" fairness); an unsubmitted attempt is abandoned after 24 h.
13. `types/database.ts` comes from `scripts/gen-types.mjs` (no Docker). It approximates `supabase gen types`; table-function columns are typed nullable. Re-generate with `npm run gen:types:cli` when Docker is available.
14. **Update:** the owner confirmed the hosted project "Mock2Pitch" (`mkglxcdtfimgmvxtddst`). Migrations are applied, advisors were run and the R2 bucket `mock2pitch-dev` exists — see `HOSTED-STATE.md`. Functions, secrets, Google OAuth and the live NVIDIA checks remain: `SETUP-STEPS.md`.

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

## L. §15 checklist (✅ verified · ◐ verified only against a stand-in · ⛔ blocked/not done)
**Repository & environment** — ✅ existing state documented, nothing overwritten · ✅ `.gitignore`/`.env.example`, Zod env (Edge: tested incl. Deno; Next: unit-tested) · ✅ no secrets in files/history.
**Spikes** — ⛔ NVIDIA models live (no network/keys; script ready) · ⛔→provisional vision image rule (180 KB, implemented, unconfirmed) · ◐ gRPC: both options built; client verified vs local server and under Deno; ⛔ real clip transcribed · ⛔ filler retention.
**Database** — ◐ migrations rebuild from scratch on PG 16 (⛔ `supabase db reset` not run: no Docker images) · ◐ all tables/constraints/FKs/cascades/indexes · ◐ owner allow-list/trigger/sync, no client escalation · ◐ daily limit (IST, race-safe with real concurrency, upload+retake, no charge on failures) · ◐ policy versioning + in-progress exception · ◐ student + admin RPCs.
**RLS** — ◐ RLS on all tables and matrix; ◐ allowed/denied for anon/A/B/blocked/admin, admin cannot read content or practise · ⛔ Supabase advisors not run (structural audit tests instead).
**R2** — ⛔ real buckets/CORS/lifecycle (none exist; lifecycle not expressible) · ◐ upload/download/delete/prefix-delete flows (fake S3) · ◐ type/size/expiry enforcement (independent SigV4 verifier; real R2 unverified) · ◐ PDF/JPEG/WAV server validation · ◐ metadata/object consistency and sweeper.
**AI pipeline** — ◐ routing (unit + handler tests with fake NVIDIA; ⛔ live run) · ◐ deck processing idempotent/resumable (⛔ Realtime not observed) · ◐ session analysis/scoring/report/audio deletion/resume (⛔ Realtime not observed) · ◐ Zod + injection safeguards · ◐ usage log, `admin_ai_usage`, masked keys.
**Account & admin** — ◐ account deletion (fake R2) · ◐ block/unblock, ratings, overview, sessions/day, AI usage, policy publish.
**Security & quality** — ✅ bundle clean (shell only; re-scan in Phase 2/3) · ✅ safe errors, logs tested · ✅ TS strict, lint, all suites run and re-run after fixes · ✅ docs · ◐ DB types generated by script.

## M. Next phase
Phase 2 builds the UI from the (missing) design handoff against `api-contracts.md`; Phase 3 wires it. Before that, close the ⛔ items: apply to the hosted project, run advisors, create R2 bucket + CORS, supply keys, run `npm run spike:nvidia` and `RUN_LIVE_AI_TESTS=1 npm run test:live-ai` (and record the results in `spikes.md`), transcribe one real clip, confirm R2 enforces signed Content-Length, confirm Realtime events.

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
