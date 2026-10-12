# Security review (§13)

Method: code review + automated tests (`tests/db/security-audit.test.ts`, `rls.test.ts`, function tests, Deno smoke tests, bundle scan, `npm audit`, secret scan). **Not done:** Supabase hosted security/performance advisors (no hosted project was touched), a penetration test, and live R2/NVIDIA behaviour.

| Area | Finding | Status |
|---|---|---|
| Auth config | Hosted = Google only; local config enables email for tests. Redirect allow-list documented. | Config documented, **hosted settings not applied/verified** (owner step) |
| RLS | Enabled on all 14 public tables (asserted by test); default privileges revoked; matrix proven for anon, A, B, blocked, admin | Verified on PG 16 |
| SECURITY DEFINER | All pin `search_path=''`, check `auth.uid()`/`is_admin`; no dynamic SQL (asserted); `my_*` views are INVOKER | Verified |
| Function exposure | anon can execute only `ist_date`; authenticated only student+admin RPCs; `svc_*` service-role only; `private` schema unusable by API roles | Verified |
| Real bug found/fixed | `citext =` unresolvable with empty `search_path` ⇒ case-sensitive owner match | Fixed + tested |
| Profile columns | client UPDATE limited to 4 columns; guard trigger blocks `role/is_blocked/email/...`; blocked users cannot edit | Verified |
| Service role | used only in Edge Functions after authorisation; not in the client bundle | Bundle scan clean (shell only — **re-run `npm run scan:bundle` in Phase 2/3**) |
| R2 | private bucket, SigV4 presign, 5/10 min expiry, signed type (+length for PDF/audio), keys server-built, CORS no wildcard | Signing verified against an independent verifier; **real R2 untested** |
| Key manipulation | `keys.*` rejects non-UUID input; client never sends keys; `asset-urls` reads keys from DB and hides existence (404) | Tested |
| Upload abuse | type, size, `%PDF-`, page count, encryption, JPEG/WAV signatures, one deck at a time, daily limit (race-tested), slide-image size checked after upload | Tested. Residual: presigned image PUT cannot cap size up front |
| Audio retention | deleted only after R2 confirms; sweeper 24 h; failed analysis keeps audio ≤ 24 h for retry | Tested. R2 lifecycle safety-net impossible with this key layout (see `r2.md`) |
| NVIDIA keys | env only; masked to last 4; never logged/stored; admin function denies non-admin | Tested |
| Prompt injection | data-only prompts + validation/clamping/substring rule | Tested with a fake model; **real-model behaviour untested** |
| Error messages | stable codes; no stack/SQL/keys/URLs; unhandled errors log only the error class name | Tested (incl. `misconfigured` names variables, never values) |
| Abuse limits | 5 sessions/day, 1 in-flight deck, 1 analysing session, AI concurrency 3, ≤ 3 analysis attempts | Tested |
| Account deletion | prefix recorded first, R2 then auth user (cascade); partial failure completed by sweeper | Tested against a failing store |
| Logs | counts and ids only | By construction; no log-capture test |
| Dependencies | `npm audit`: **0 vulnerabilities** after upgrading to Next 16.4 / Vitest 5 | Verified |
| Secrets in git | patterns scanned across tracked files and full history: none; only `.env.example` tracked. Seed passwords are intentionally committed, local-dev only | Verified |

## Residual risks / follow-ups
1. Internal secret `x-asr-key` travels Edge → Netlify route in a header (TLS); acceptable but prefer Option A if it proves viable in the Edge Runtime.
2. `verify_jwt=true` may need to be `false` on projects with asymmetric JWT keys (the code verifies the token itself either way).
3. Admin lists include deck titles (user-supplied text). Decide whether that is acceptable (handoff §F).
4. The seed passwords are public in git history; never run `seed.sql` against a hosted project.
5. No rate limiting beyond business rules (e.g. `deck-upload-init` spam creates and supersedes `awaiting_upload` rows); consider Supabase Auth/edge rate limits.
