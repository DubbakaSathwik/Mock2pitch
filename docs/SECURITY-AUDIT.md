# Security audit (pre-production, Nov 2026)

Scope: Supabase (RLS, grants, functions, Auth guards), Edge Functions, Cloudflare R2 usage, Next.js app, Netlify config, dependencies, CI.
Method: code review, a live attacker simulation on the production database (normal-student identity; every write rolled back), the full test
suite against a real PostgreSQL, a production build with planted canary secrets, and a real-browser XSS / CSP test.

## Fixed
| Severity | Issue | Fix |
|---|---|---|
| Critical (advisory) | `next@16.4.0` in the range of three advisories (RCE in image optimizer / `use cache`, Server Actions DoS) | `next@16.4.5` |
| Medium | Open redirect after Google sign-in: `?next=/%09/evil.com` resolved to `//evil.com` | `lib/safe-next.ts` rejects control characters / backslashes and checks the resolved origin |
| Medium | zod 3.x flagged by `npm audit` (memory exhaustion on huge arrays) | zod 4.6.7 (app + Edge Functions) **and** a 64 KB streaming body cap in `readBody` |
| Medium | CSP allowed `'unsafe-inline'` scripts | per-request nonce + `'strict-dynamic'` (`proxy.ts`, `lib/csp.ts`); pages render per request |
| Low | Google-only sign-up guard exempted every `@mock2pitch.test` address | migration `20261104000012`: only `selftest-<digits>@mock2pitch.test` with a confirmed email |
| Low | Public `health` function did a DB query + R2 request on every anonymous call | 10 s result cache |
| Low | Object uploaded through a presigned URL after the deck was cancelled stayed in R2 untracked | maintenance sweep step 1e removes late arrivals |
| Low | Workflows: default token permissions, Supabase CLI `latest` | `permissions: contents: read`, pinned CLI, serialised deploys |
| Hardening | Secret could be placed in a `NEXT_PUBLIC_*` variable | production build fails if a secret-looking public variable exists or the "anon" key is really a service-role / `sb_secret_` key |

## Accepted residual risk
* **Slide-image upload size** cannot be capped in the presigned URL (the image does not exist when the URL is issued; R2 has no POST policy).
  Compensating controls: URL lives 5 min, the object is size-checked and deleted by `deck-process`, pending files are swept after 1 h, late
  uploads are swept (above), 5 uploads per user per day.
* **`style-src 'unsafe-inline'`**: React renders inline `style` attributes; a nonce cannot cover attributes. Styles cannot execute script.
* **Client-side route guards**: protected pages return an HTML shell to anyone; all data is protected by RLS / Edge Function ownership checks
  (verified by the attacker simulation), not by the guards.
* GitHub Actions are pinned to major tags, not commit SHAs.
