# Phase 4 security audit (running)

Status: **partial** — items below were verified in Session 1 (local app → hosted backend, code, repo). Everything marked ⏳ must be re-tested on the deployed origin before release.

| # | Area | Check | Result | Evidence |
|---|---|---|---|---|
| 1 | Secrets | Git history scan (all branches) for JWT-shaped strings, `nvapi-`, `sb_secret_`, private keys, AWS-style ids, R2 hostnames | ✅ clean — the only hit is the deliberately forged, invalid token in `e2e-int/03` | `git log -p --all` grep, 2026-10-15 |
| 1b | Secrets | Client bundle (supabase-mode build) | ✅ `scan:bundle` clean (9 name patterns, 10 secret values, 69 files); no mock backend/dev panel (`check-prod-bundle`) | Phase 3 run on identical code + CI |
| 1c | Secrets | Netlify env has no server secrets | ⏳ site not created yet |
| 2 | Dependencies | `npm audit --omit=dev` | ✅ 0 vulnerabilities | 2026-10-15 |
| 2b | Licences | production deps: MIT 49, Apache-2.0 15, BSD-3 11, ISC 7, 0BSD 2, CC-BY-4.0 1 (`caniuse-lite` data, build-time), LGPL-3.0 2 (`@img/sharp-libvips`, unmodified binary used by Next image optimisation), (MIT AND Zlib) 1; fonts OFL-1.1 (`public/fonts/OFL-*.txt`); pdf.js Apache-2.0; Riva protos Apache-2.0 (NVIDIA, header of `riva/descriptor.ts`) | ✅ no GPL/AGPL | `license-checker --production` |
| 3 | AuthN | Sign-up is Google-only (hook + DB guard) | ✅ guard (tests/db/auth-hook.test.ts, INT-04); ⏳ hook enabled in dashboard; ⏳ Email provider off at cut-over |
| 3b | AuthN | Open redirects in `next` | ✅ INT-06 (+ `safe-next` unit tests); ⏳ encoded variants on the deployed origin |
| 3c | AuthN | Forged / missing / expired JWT | ✅ INT-03 (gateway or function → 401) |
| 3d | AuthN | Cookies `Secure`/`SameSite`, sign-out, refresh | ⏳ deployed origin |
| 4 | AuthZ / RLS | Student B vs A's rows on every table, admin RPCs, functions with A's ids, Realtime | ✅ INT-04 (6/6, Phase 4 run) |
| 4b | AuthZ | Admin cannot practise / read student content; blocked student writes refused | ✅ INT-05 |
| 4c | AuthZ | Supabase advisors | 17 WARN "authenticated can execute SECURITY DEFINER" + 3 INFO "RLS enabled, no policy" + 4 INFO unused indexes — see justification below | `get_advisors` 2026-10-15 |
| 5 | Storage | Presigned PUT binds type/length; tampered PUT refused; GET URLs 404 after deletion | ✅ INT-03, INT-10 |
| 5b | Storage | Bucket private, CORS exact, sweeper deletes audio > 24 h | ✅ sweeper (functions test + cron 277/277 succeeded); ⏳ CORS from the deployed origin (R2 CORS to be applied) |
| 6 | Input / abuse | Bad PDFs, > 10 pages, invalid WAV, unknown fields, daily limit, one in-flight deck/analysis | ✅ INT-03/06/08/11; ⏳ rapid-repeat / concurrency test |
| 7 | AI safety | Prompt injection in slide/transcript; schema-valid output; exact-substring quotes; no user content in `ai_usage_log` | ✅ `tests/functions/session.test.ts` (injection test), `ai_usage_log` columns reviewed (ids/status/latency/tokens only) |
| 8 | Web | CSP/headers/clickjacking/mixed content | ⏳ deployed origin (config reviewed in Phase 3: no `unsafe-eval` in prod; `'unsafe-inline'` residual for Next bootstrap scripts) |
| 9 | Privacy | Published text vs behaviour | ❌→ fixed in draft: v1.0 under-described owner visibility (deck titles, attempt scores/dates, rating comments); `terms-privacy-v1.1-draft.md` ⏳ owner approval + publish |

## Advisor findings — justification
* **17 × `authenticated_security_definer_function_executable` (WARN):** these are the app's RPC API (`rate_report`, `start_practice_session`, `accept_policy`, `set_deck_pinned`, `has_accepted_latest_policy`, `check_can_practise`, `is_admin`, and the ten `admin_*`). Each is `SECURITY DEFINER` with `search_path = ''`, derives the caller from `auth.uid()` and refuses non-owners/non-admins inside (`private.require_admin()`), and every one was invoked from a second student's session in INT-04 (answers `not_found`/`forbidden`). Revoking `EXECUTE` would break the product. **Accepted.**
* **3 × `rls_enabled_no_policy` (INFO):** `admin_actions`, `ai_key_slots`, `ai_usage_log` are server-only: RLS on, no policy, no grant to `anon`/`authenticated` (INT-04 "server-only tables denied"). **Intended.**
* **4 × unused index (INFO):** no production traffic yet; the indexes back foreign keys/filters used at scale. **Kept; re-check after launch.**
