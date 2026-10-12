# Supabase backend reference

## Migrations (`supabase/migrations/`)
| File | Content |
|---|---|
| `…0001_core_schema.sql` | all tables, constraints, partial unique indexes, FK indexes, `updated_at` triggers, `private` schema |
| `…0002_auth_roles_rls.sql` | `is_admin()`, owner allowlist logic, `handle_new_user` trigger, `sync_owner_role`, profile guard trigger, grants, RLS + policies |
| `…0003_policy_and_practice.sql` | `ist_date`, policy functions, daily limit, `start_practice_session`, pin, rate, read views, Realtime publication |
| `…0004_admin_rpcs.sql` | the ten admin RPCs |
| `…0005_service_functions_and_seed.sql` | service-role functions (`svc_*`) + the 9 `ai_key_slots` rows |
| `…0006_seed_policy_v1.sql` | policy `v1.0` (**draft text**, see handoff §F) |
| `…0007_cron_maintenance.sql` | `private.invoke_maintenance_sweep()` and the 15-minute `pg_cron` job (skipped where the extensions are missing) |
| `…0008_account_deletion_functions.sql` | deletion bookkeeping (`svc_begin/finish_account_deletion`, `svc_pending_deletions`) |

`supabase/seed.sql` is **local development only** (test accounts, ParkSense deck, 62→74 reports, ratings, blocked student).

## Tables
`profiles`, `policy_versions`, `policy_acceptances`, `decks`, `practice_sessions`, `files`, `slides`, `usage_events`, `session_slide_results`, `reports`, `report_ratings`, `ai_key_slots`, `ai_usage_log`, `admin_actions` (admin audit), plus `private.owner_allowlist` and `private.pending_deletions`. Types: `types/database.ts` (`npm run gen:types`).

Deviations from §5 (all deliberate): enums are `CHECK` constraints; `practice_sessions (deck_id, attempt_number)` is unique **among non-abandoned rows** (an abandoned, unsubmitted attempt is re-used rather than counted twice); extra columns `profiles.deletion_requested_at` (required by §9.7), `ai_key_slots.credit_period_start` (so an admin can start a new credit period for a fresh key), and a `decks_one_active_per_owner` / `sessions_one_analysing_per_owner` pair of partial unique indexes that make the "one at a time" rules race-free in the database.

## Row Level Security
RLS is enabled on **every** public table. Default privileges are revoked so new tables/functions are deny-by-default.

| Table | anon | authenticated (own rows) | write |
|---|---|---|---|
| `policy_versions` | SELECT | SELECT | admin RPC only |
| `profiles` | – | SELECT own; UPDATE **only** `full_name, college, year, branch`, not when blocked | trigger only |
| `policy_acceptances`, `decks`, `practice_sessions`, `slides`, `usage_events`, `session_slide_results`, `reports`, `report_ratings` | – | SELECT own | RPC / service role only |
| `files` | – | SELECT own, `kind <> 'audio_clip'`, **columns exclude `bucket` and `object_key`** | service role only |
| `ai_key_slots`, `ai_usage_log`, `admin_actions` | – | – (no grant, no policy) | admin RPC / service role |

The admin has **no** policy on any student content table. `tests/db/rls.test.ts` proves it (admin selects return 0 rows) and `tests/db/security-audit.test.ts` checks privileges structurally.

## RPC catalogue
Errors are raised as `raise exception '<code>'`, so supabase-js returns `error.message === '<code>'`.

**Student** (`authenticated`):
| RPC | Args | Returns | Error codes |
|---|---|---|---|
| `has_accepted_latest_policy()` | – | boolean | – |
| `accept_policy(p_version_id)` | uuid | void (idempotent) | `not_authenticated`, `is_admin`, `not_latest_policy` |
| `check_can_practise(p_check_limit=true, p_require_policy=true)` | booleans | void | `not_authenticated`, `is_admin`, `blocked`, `profile_incomplete`, `policy_not_accepted`, `daily_limit_reached` |
| `start_practice_session(p_deck_id, p_total_minutes)` | uuid, 1–20 | `practice_sessions` row | the codes above (limit only for retakes) + `invalid_minutes`, `not_found`, `invalid_state` |
| `set_deck_pinned(p_deck_id, p_pinned)` | uuid, bool | void | `is_admin`, `blocked`, `not_found` |
| `rate_report(p_report_id, p_stars, p_comment)` | uuid, 1–5, ≤500 chars | `report_ratings` row | + `invalid_stars`, `comment_too_long`, `not_found`, `already_rated` (no edits in V1) |
| `my_dashboard_stats()` | – | `sessions_used_today, daily_limit, next_reset_at, attempts_count, average_score, best_score, total_practice_ms, total_key_points_covered` | – |
| `my_decks()` | – | ready decks, pinned first then latest activity | – |
| `my_deck_detail(p_deck_id)` | uuid | attempts with overall + 4 sub-scores, wpm, delta | – |
| `is_admin()` | – | boolean | – |

**Admin** (`authenticated`, each starts with `require_admin` → `not_authenticated` / `forbidden`): `admin_overview`, `admin_sessions_per_day(p_days)`, `admin_list_students(p_search, p_limit, p_offset)`, `admin_student_detail(p_user_id)`, `admin_set_blocked(p_user_id, p_blocked)` (`cannot_block_admin`, `not_found`; audited), `admin_ratings(p_stars)`, `admin_ai_usage(p_days)`, `admin_set_credit_limit(p_slot_id, p_limit, p_reset_period)` (`invalid_limit`), `admin_publish_policy(label, terms, privacy, note)` (`invalid_label`, `invalid_body`, `label_not_increasing`), `admin_policy_versions()`. They return summary fields only — no slide content, scripts, transcripts or feedback text. Deck **titles** are included in attempts/ratings lists, as the design shows them (see handoff §F).

**Service role only** (`svc_*`): `svc_complete_deck_upload`, `svc_finalize_report`, `svc_ai_slot_states`, `svc_touch_active`, `svc_begin_account_deletion`, `svc_finish_account_deletion`, `svc_pending_deletions`.

"AI credits used" = count of `ai_usage_log` rows with outcome **`success` or `invalid_output`** (billable) since the slot's `credit_period_start`. `rate_limited`, `server_error`, `timeout`, `bad_request` do not count.

## Realtime
Publication `supabase_realtime` contains `decks` and `practice_sessions` only. RLS (own-row SELECT) restricts what each user receives. Progress strings: see `api-contracts.md`. **Realtime delivery was not observed** (no Realtime server available here); the publication membership is tested.

## Edge Functions
| Function | Auth | Purpose |
|---|---|---|
| `deck-upload-init` | JWT | pre-flight (`check_can_practise`), create deck + file rows, PUT URL |
| `deck-upload-complete` | JWT | validate PDF, consume 1 session, issue image PUT URLs |
| `deck-process` | JWT or internal secret | verify images, run vision model per slide (background) |
| `asset-urls` | JWT, student only | 10-minute GET URLs from DB-held keys |
| `session-submit-init` | JWT | validate clips, issue audio PUT URLs |
| `session-analyse` | JWT or internal secret | verify audio, transcribe, report, finalise, delete audio |
| `account-delete` | JWT, student only | delete R2 prefix, then auth user (cascade) |
| `admin-ai-keys` | JWT, admin only | masked key configuration per purpose/slot |
| `maintenance-sweep` | internal secret only | cleanup + resume (every 15 min) |

`verify_jwt = true` for the purely user-facing ones, `false` where an internal caller is also valid (the code verifies the JWT with the Auth server in every case). **If a deployed project uses asymmetric JWT signing keys and the gateway rejects tokens, set `verify_jwt = false` for those functions in `config.toml`; nothing else changes.**

## Cron
`maintenance-sweep` every 15 minutes via `pg_cron` + `pg_net`; the base URL and secret are read from Supabase Vault (setup in `owner-setup.md`). **Not exercised here** (extensions unavailable in the test Postgres); the sweep logic itself is tested through its HTTP handler.

## Auth
Google is the only hosted provider (D2). Local config keeps email/password on for tests and `seed.sql`. Owner = email in `private.owner_allowlist` **and** a verified email → `profiles.role='admin'` at sign-up, or when the email is later confirmed, or via `private.sync_owner_role(email)`. Clients cannot change `role`, `is_blocked` or `email` (column privileges + guard trigger + RLS).
