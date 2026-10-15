# Phase 3 security review

Scope: the new surface added by Phase 3 (browser ↔ Supabase/R2 adapter, cookie sessions, `proxy.ts`, OAuth callback, Auth hook, CI/Netlify
config) plus a live re-test of the Phase 1 controls from a real client. Evidence column = spec / command that proves it.

## Verified from the client side (live, real project)
| Control | Result | Evidence |
|---|---|---|
| RLS: a student reads only their own rows (profiles, decks, slides, sessions, results, reports, ratings, usage, acceptances) | ✓ | spec 04 (B vs NEW) |
| No writes to another user's rows, no role/blocked/limit escalation through PostgREST | ✓ | spec 04 |
| Server-only tables and admin RPCs denied to students; `hook_before_user_created` not callable by clients | ✓ | spec 04 |
| Other users' objects look like "does not exist" (`not_found`), not "forbidden" (no enumeration) | ✓ | spec 04 |
| `files`: no `object_key`, audio clips never visible to students | ✓ | spec 04 |
| Realtime `postgres_changes` obeys RLS (B receives nothing for NEW) | ✓ | spec 04 |
| Admin cannot read student content or practise; cannot block self; owner account cannot be deleted by the function | ✓ | spec 05 + `account-delete` `is_admin` |
| Blocked user: reads work, all writes refused | ✓ | spec 05 |
| Upload validation is server-side (type, name, size, content, page count, encryption, audio format/sample rate/channels) | ✓ | specs 03, 08 |
| Presigned URLs bind Content-Type and Content-Length (tampered PUT refused by R2) and expire; deleted accounts' URLs 404 | ✓ | specs 03, 10 |
| Forged / missing / expired JWT rejected at the gateway or in the function | ✓ | spec 03 (last test) |
| Daily limit enforced by the database (429), not the client | ✓ | spec 06 |
| Policy gate re-checked on every navigation; sessions in progress stay submittable | ✓ | spec 09 + handler tests |
| Open redirects ignored (`next` must be a same-origin path) | ✓ | spec 06 + `safe-next` unit tests |
| Account deletion removes R2 prefix, auth user, all rows; AI log anonymised | ✓ | spec 10 + residue SQL |

## Code review of the Phase 3 surface
* **Tokens/cookies:** sessions are `@supabase/ssr` cookies (`createBrowserClient`/`createServerClient`); `proxy.ts` refreshes them on navigation. No token is put in `localStorage`, URLs or logs. Server code never trusts the cookie hint (`auth.peek()` is only used to prefetch data in parallel; the profile read under RLS is what validates the JWT).
* **Keys in the browser:** only `NEXT_PUBLIC_SUPABASE_URL`, the **publishable/anon** key and the app URL reach the client. The service-role key, R2 secrets, NVIDIA keys and the internal transcribe secret exist only as Edge Function / server secrets. `npm run scan:bundle` (9 name patterns, 10 secret env values) found nothing in 69 client files of the supabase-mode build.
* **Mock code in production:** the supabase-mode bundle contains no mock backend, dev panel, `__m2pMock` hook or `/dev` routes (`scripts/check-prod-bundle.mjs`); production builds refuse mock mode unless `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1` (used only for deploy previews).
* **Error handling:** adapter errors are normalised to a closed set of codes; in production a Zod mismatch becomes `unknown` and logs only the code, never payloads (which may contain transcripts). Dev builds throw on drift.
* **CSP/headers** (`next.config.mjs`): `connect-src` limited to the Supabase https/wss origin and `*.r2.cloudflarestorage.com`; no `unsafe-eval` in production (`'unsafe-inline'` for Next's bootstrap scripts and `'wasm-unsafe-eval'` for pdf.js remain, as documented in the file header); HSTS, frame, referrer and permission policies as in Phase 2. Netlify serves them with the app (`netlify.toml`).
* **OAuth callback** (`app/auth/callback/route.ts`): exchanges the code server-side, only follows a validated same-origin `next`, maps provider errors to fixed codes shown on the sign-in page.
* **Realtime:** filtered by `id=eq.<id>`; RLS decides what is delivered.
* **CI:** workflows use no secrets for tests (PostgreSQL service container, fakes); the function-deploy workflow keeps its existing secrets and runs only on `main` or manual dispatch.

## Findings
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **Medium → fixed** | Public email sign-up was possible because the Auth hook was not yet enabled in the dashboard and the Email provider had to be on for tests | DB trigger guard on `auth.users` (migration `…0010`) rejects non-Google sign-ups regardless of the dashboard; test users are inserted by SQL. Owner still enables the hook (B3) and turns Email **off** before launch |
| 2 | Low | `session-submit-init` leaked a 500 and removed already-uploaded clips on a repeated init | fixed + test |
| 3 | Low (availability) | One transient 5xx on the only report key blocked analysis for 30 s and could exhaust the 3-attempt cap | same-key retry + UI delay; live-proven |
| 4 | Info | Gateway `verify_jwt` accepts the legacy HS256 token; the project still uses the legacy JWT secret | works today; owner decides on JWT signing keys (Phase 4) |
| 5 | Info | `ai_usage_log` keeps rows after account deletion (anonymised, `user_id` null, no content) | by design (cost accounting) |
| 6 | Info | A test policy version `v1.0.1` (same text) remains until the owner deletes it | see `integration.md` §7 |

No secrets were committed (`git grep` for JWT/secret-key patterns finds only the deliberately forged invalid token in spec 03; the bundle scan is clean); test-user passwords live only in the git-ignored `.env.integration.local` and the users no longer exist.

## Not verified (and why)
* Google OAuth round trip with a real Google account (owner-only; needs the OAuth client — `owner-steps.md` A/B).
* CSP and headers on the deployed Netlify origin, R2 CORS from the deployed origin (Netlify deferred by the owner).
* Safari/WebKit recording and real mobile devices (`device-checks.md`).
