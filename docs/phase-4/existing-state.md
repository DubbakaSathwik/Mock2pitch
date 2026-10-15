# Phase 4 — existing state (inspection, 2026-10-15, read-only)

## Real users (§0.1)
`auth.users` = **0**; `profiles` for non-test emails = **0**. Nobody has signed in yet, so every Phase 4 test so far can only touch test data. 44 anonymised `ai_usage_log` rows are the only content (credit evidence).

## Hosted Supabase `mkglxcdtfimgmvxtddst`
| Item | Finding |
|---|---|
| Migrations | 10 applied: `…0001`–`…0008`, `20261015000009_auth_hook_google_only`, `20261015000010_auth_users_google_only_guard` (the two Phase 3 ones are recorded out of order by timestamp; harmless). |
| RLS | 14 public tables, **0 without RLS**. |
| Edge Functions | 10 ACTIVE, all version 11 except `ops-selftest` v10. `verify_jwt=true`: account-delete, admin-ai-keys, asset-urls, deck-upload-complete, deck-upload-init, session-submit-init. `false` (verify in code): deck-process, maintenance-sweep, session-analyse, ops-selftest. |
| Cron | `maintenance-sweep` `*/15 * * * *`, active; 277 runs, all `succeeded`, last 16:00 UTC today. |
| AI key slots | 9 rows (3 purposes × primary/fallback_1/fallback_2), limit 1000 each. Primary slots still show old cooldown stamps (all expired). **Whether fallback keys are configured cannot be read with the available tools** (secret values/names are not listable) — Admin → AI usage shows it once the owner signs in. |
| Security advisors | INFO ×3: `admin_actions`, `ai_key_slots`, `ai_usage_log` have RLS on and no policy (intended: server-only tables, no client grants). WARN ×17: `SECURITY DEFINER` functions executable by `authenticated` (`accept_policy`, `rate_report`, `set_deck_pinned`, `start_practice_session`, `check_can_practise`, `has_accepted_latest_policy`, `is_admin`, and the 10 `admin_*` RPCs). These are the product's API; each one authorises inside (`private.require_admin()` / `auth.uid()` ownership) and was probed from a student session in Phase 3 spec 04. To be justified one by one in `security-audit.md`. |
| Performance advisors | INFO ×4 unused indexes (`profiles_last_active_idx`, `policy_acceptances_version_idx`, `decks_owner_created_idx`, `sessions_policy_version_idx`) — no data yet; keep (needed at scale), documented. |
| Policy versions | `v1.0` (draft text) and the test version `v1.0.1` (identical text). |
| Auth settings (providers, Site URL, hook enabled?, JWT key type, rate limits) | **Not readable with the available tools** — owner steps verify them (§4 of the spec). The DB guard keeps sign-up Google-only regardless. |

## Netlify
Account has **one site, `boutiqoo`** (not this project; will not be touched). **No Mock2Pitch site exists yet.**

## GitHub
PR #13 open (`claude/sleepy-rubin-mm8mb1` → `main`), CI run 20 green (6/6 jobs) on `9fd5905`; later head `d6dad6a` carries docs only. `main` = Phase 1 only. Branch protection and workflow-secret names not readable with the available tools.

## R2
Bucket `mock2pitch-dev` exists (created 2026-10-12, ENAM). CORS currently applied and object count cannot be read from here; Phase 3 cleanup left it expected-empty — the owner confirms in the dashboard.

## Gaps vs the Phase 3 owner steps
| Step | State |
|---|---|
| A. Google OAuth client + consent screen | not done |
| B1 Google provider in Supabase | not done (cannot verify) |
| B2 Email provider on only for tests | on (Phase 3); off at cut-over |
| B3 Before-User-Created hook enabled | not verified; DB guard in place |
| B4 URL configuration | not done |
| B5 `APP_ALLOWED_ORIGINS`, `NVIDIA_SLIDE_MODEL`, fallback keys | not verified |
| C. R2 CORS for the production origin | not done (placeholder in `infra/r2-cors.json`) |
| D. Netlify site | **does not exist** |
| Terms/Privacy v1.1, delete `v1.0.1` | not done (owner text needed) |
