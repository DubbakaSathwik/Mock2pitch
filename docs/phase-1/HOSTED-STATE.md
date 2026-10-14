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
- **Vault finding:** `internal_function_secret` contains the literal placeholder text, not a real secret → every sweep is rejected. Fix = handoff §F R1.
- **Cron:** 180+ successful job runs (the SQL call succeeds; the HTTP result is what returned 403).
- `auth.users` is empty: nobody has signed in yet (no UI until Phase 2).

## Not done yet (superseded: see PHASE-1-HANDOFF.md §F "Remaining to close Phase 1")
Edge Functions are **not deployed** (their code is multi-file and needs the CLI or the GitHub workflow below), no function secrets are set, Google OAuth is not configured, no Netlify site exists.
