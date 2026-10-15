# Hosted environment state (updated after the owner confirmed the project)

## Supabase project "Mock2Pitch" — `mkglxcdtfimgmvxtddst` (ap-northeast-1, Postgres 17.11)
Applied on 2026-10-12 through the Supabase tools (project was empty before):
| Migration | How applied |
|---|---|
| 0001 core schema | `apply_migration` |
| 0002 auth/roles/RLS | **in parts via SQL** (a single transaction timed out at the tool's 60 s limit; the two triggers on `auth.users` were created one statement at a time). Recorded in the migration history by hand. Functionally identical to the file in the repo. |
| 0003, 0004, 0005, 0006, 0007, 0008 | `apply_migration` |
`supabase/seed.sql` was **not** applied (local development only).

Verified on the hosted database after applying:
- 14 public tables, **0 without RLS**; 9 `ai_key_slots`; policy `v1.0` present.
- `anon` can execute only `ist_date`; 21 public functions are executable by `authenticated` (the 10 student + 10 admin RPCs + date helper); every `SECURITY DEFINER` function pins `search_path`.
- Both `auth.users` triggers exist; Realtime publishes only `decks`, `practice_sessions`; cron job `maintenance-sweep */15 * * * *` exists (does nothing until the Vault secrets are added).
- Owner allow-list contains `dubbakasathwik@gmail.com` (inserted by SQL, not in a migration). Sign in with Google to become `admin`.

### Supabase advisors (run after the migrations)
- **Security** — 0 errors. INFO ×3: `admin_actions`, `ai_key_slots`, `ai_usage_log` have RLS enabled with no policy — **intentional** (deny-all; only admin RPCs / service role). WARN ×17: "SECURITY DEFINER function executable by authenticated" for the 10 student and 10 admin RPCs — **intentional**: every one checks `auth.uid()` / `is_admin` inside, and the admin ones raise `forbidden` for students (proven by the test suite). Not suppressible without removing the API, so they remain as accepted findings.
- **Performance** — INFO ×26 "unused index": the database has had no traffic yet. Not actionable now; revisit after real usage.

## Cloudflare R2
- Bucket **`mock2pitch-dev`** created (location ENAM, Standard, default jurisdiction). New buckets have **no public access**; do not enable the `r2.dev` URL or a custom domain.
- Not possible with the available tools (you must do these): create the R2 API token, set the CORS policy, find the Account ID. Steps are in `docs/phase-1/SETUP-STEPS.md`.

## Update 2026-10-14 (after the owner finished the setup steps)
- **9 Edge Functions are ACTIVE** (version 1) with their own `deno.json` import maps; `verify_jwt` true for the user-facing six, false for `deck-process`, `session-analyse`, `maintenance-sweep`.
- **Boot check:** the function runtime logs `booted`; the cron call at 16:15 UTC returned `403 forbidden` from our handler, proving the environment validated (missing variables would have returned `500 misconfigured`).
- **Vault finding (fixed):** `internal_function_secret` first held the literal placeholder text, so every sweep was rejected. The owner replaced it; since then the 15-minute sweep returns `200` from the handler.
- **Cron:** 180+ successful job runs (the SQL call succeeds; the HTTP result is what returned 403).
- `auth.users` is empty: nobody has signed in yet (no UI until Phase 2).

## Update 2026-10-14 (final live verification)
- **10 Edge Functions ACTIVE** (the 9 product functions + `ops-selftest`, deployed by the GitHub workflow on each merge to `main`). `ops-selftest` accepts only the internal secret; it can be deleted once Phase 2 starts.
- Function secrets are set; the self-test ran R2, NVIDIA (3 purposes) and the full pipeline against them — results in `spikes.md`.
- Still not done: Google OAuth provider, Netlify site, adding the Netlify origin to the R2 CORS policy. Nobody has signed in yet.


## Update — Phase 3 (2026-10-15)
* **One environment:** project `mkglxcdtfimgmvxtddst` and bucket `mock2pitch-dev` serve as production (owner decision). No separate staging/prod.
* Migrations: 10 applied (added `20261015000009_auth_hook_google_only`, `20261015000010_auth_users_google_only_guard`).
* Edge Functions: 10 ACTIVE, version 11 (deployed by the workflow on this branch with the `session-submit-init` fix and the router same-key retry).
* Auth: users table empty after test cleanup (integration test users removed). Email provider is enabled **only** for the test windows — turn it off before launch. Google provider, the Before-User-Created hook, URL configuration and `APP_ALLOWED_ORIGINS`: pending owner steps (`docs/phase-3/owner-steps.md`).
* `policy_versions`: `v1.0` plus a harmless test version `v1.0.1` (identical text) awaiting deletion (`docs/phase-3/integration.md` §7).
* `ai_usage_log`: 44 anonymised rows (credit evidence for Phase 1 and Phase 3).
