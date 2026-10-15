# Release checklist (cut-over and every later release)

Use for the first launch and for every later change to `main`. Tick in the PR description.

## Before merging
- [ ] CI green on the PR head: quality (typecheck, lint, all Vitest), build (mock + supabase mode + bundle guards), e2e desktop/mobile/a11y, WebKit smoke.
- [ ] Migrations are additive and tested (`npm run test:db`); the PR lists every migration and Edge Function change.
- [ ] No secrets in the diff (`git grep -nE "eyJ[A-Za-z0-9_-]{20,}\.|sb_secret_|nvapi-"` finds only test fixtures).
- [ ] `npm audit --omit=dev` shows 0 high/critical.

## Deploy order (backend first, then frontend)
1. Merge to `main` → "Deploy Supabase Edge Functions" runs on pushes touching `supabase/functions/**` (otherwise run it manually).
2. Apply any new migration (additive only) with the Supabase tool or `supabase db push`; re-run Supabase advisors.
3. Netlify builds `main` automatically; wait for "Published".
4. Smoke test on production (below).

## Smoke test (10 minutes, real Google account or test users)
- [ ] Landing, Terms, Privacy load; response headers show CSP, HSTS, `Permissions-Policy: microphone=(self)`.
- [ ] Owner signs in → `/admin`; second account signs in → Terms → profile → dashboard.
- [ ] Upload a 3-slide PDF → slides read → record one slide → submit → report appears → rate it.
- [ ] Admin → AI usage shows Configured keys; no unexpected "Cooling down".
- [ ] Sign out; protected pages redirect to sign-in.

## First launch only (cut-over)
- [ ] Owner-approved Terms/Privacy **v1.1** published in Admin → Terms; test version `v1.0.1` removed.
- [ ] Google consent screen published to Production; Supabase URL configuration and `APP_ALLOWED_ORIGINS` = production origin + `http://localhost:3000`; R2 CORS = same origins.
- [ ] Final integration run on production with test users → clean up → residue 0 (DB and R2).
- [ ] **Email provider switched off** (Supabase → Authentication → Providers → Email); password sign-in fails; Google works.
- [ ] Tag `v1.0.0`; `CHANGELOG.md` and `HOSTED-STATE.md` updated.

## Rollback
Netlify "Publish deploy" on the last good deploy; redeploy functions from the last good commit; corrective migration if the schema is wrong (runbook 2.8).
