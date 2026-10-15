# Phase 3 — existing state (inspection, 2026-10-15)

## Repository
* Branch `claude/sleepy-rubin-mm8mb1` carries Phase 2 (UI on the mock layer) **on top of Phase 1**; GitHub `main` still only contains Phase 1 (PRs #6–#10). Phase 2 has not been merged, so a Netlify deploy needs a merged PR (owner decision, 2026-10-15: owner merges one PR, then connects Netlify).
* Seam: `DataPort` (`lib/data/types.ts`, 11 sub-ports, ~55 methods). `getData()` (`lib/data/index.ts`) returned the mock adapter and threw in `supabase` mode. `lib/data/supabase/` held a README only.
* `lib/supabase/browser.ts` used plain `createClient` (no cookies); `lib/supabase/admin.ts` is the service-role client (server only, unused). `app/auth/callback/route.ts` was a placeholder redirecting to `/sign-in?error=oauth_not_configured`.
* Next.js 16.4: the request-interceptor convention is `proxy.ts` (`middleware` is deprecated), verified in `node_modules/next/dist/docs/.../proxy.md`.
* CSP (`next.config.mjs`) already allows the Supabase https/wss origin (from `NEXT_PUBLIC_SUPABASE_URL` at build time), `*.r2.cloudflarestorage.com`, Google avatars, blob:.
* Guards (`features/guards/gate.ts`, `components/app/Gate.tsx`): decisions from session role + profile + policy acceptance; `/session/*` is policy-exempt; acceptance re-checked on every navigation. Realtime watcher with a 3 s polling fallback after 10 s quiet (`features/realtime/watch.ts`).
* CI: only `.github/workflows/deploy-supabase-functions.yml` (deploys functions on pushes to `main` that touch `supabase/functions/**`).
* Playwright projects: `desktop-chrome`, `mobile`, `a11y`, `webkit-smoke` (mock mode, dev server on :3100).

## Hosted Supabase `mkglxcdtfimgmvxtddst` (read-only inspection through the Supabase tools)
| Item | Finding |
|---|---|
| Migrations | 8 applied (core schema … account deletion), as `HOSTED-STATE.md` says. Phase 3 adds `20261015000009_auth_hook_google_only` (additive). |
| Edge Functions | 10 ACTIVE (version 9; `ops-selftest` v8). `verify_jwt=true`: account-delete, admin-ai-keys, asset-urls, deck-upload-complete, deck-upload-init, session-submit-init. `verify_jwt=false`: deck-process, session-analyse, maintenance-sweep, ops-selftest (their code verifies the JWT or the internal secret itself). |
| Realtime publication | `supabase_realtime` contains exactly `decks` and `practice_sessions`. Replica identity is `default` for both: UPDATE events carry the full **new** row (all columns) for rows the subscriber can SELECT under RLS, which is what `DeckEvent`/`SessionEvent` need; no migration required. |
| API keys | A legacy HS256 `anon` JWT **and** a modern `sb_publishable_…` key exist and are enabled. The legacy anon key being HS256 indicates the legacy JWT secret is still in use (to be confirmed by the owner in Project Settings → JWT Keys); the gateway `verify_jwt` check is therefore expected to work with user tokens. Verified per function in the live tests (see `integration.md`). |
| Vault / cron | Vault holds `functions_base_url` and `internal_function_secret`; cron `maintenance-sweep` every 15 min (as documented). |
| Auth providers / URL config | Not readable with the available tools (no Auth config API). Owner steps in `owner-steps.md` set and report them. |
| Function secrets | Names are not listable with the available tools (values are masked in the dashboard anyway). `NVIDIA_SLIDE_MODEL` is re-set by the owner step B5 and verified indirectly by a live deck-processing run. |
| R2 CORS | Not readable with the available tools; `infra/r2-cors.json` still has the Netlify placeholder; applied by the owner (step C) and verified with a real browser PUT from the deployed origin. |
| Data | `auth.users` was empty before Phase 3 (nobody had signed in). |

## Discrepancies and risks recorded
1. Phase 2 is unmerged on `main` (see above).
2. The Cloud sandbox's network policy blocks `*.supabase.co`, `*.r2.cloudflarestorage.com` and `*.netlify.app` by default; the owner must add them under the environment's allowed domains before any live test can run from the sandbox.
3. One environment: the owner decided (2026-10-15) that **one Supabase project and one R2 bucket are production** (no separate staging). Test runs therefore use only `@mock2pitch.test` users, are credit-capped, and delete everything they create; the Email provider is enabled only for test windows and the Google-only hook stays installed.
4. `types/database.ts` returns `Json` for the jsonb RPCs; the adapter validates them with Zod instead of trusting the types.
