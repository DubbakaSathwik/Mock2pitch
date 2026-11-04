# Deployment checklist (Netlify web app + Supabase backend)

Last verified: typecheck, lint, 456 unit / function / frontend / database tests, both production builds and the bundle guards pass. The only tests not run in CI-less environments are the two that need the Deno binary.

## 1. Order
1. **Database migrations** first (functions assume them). Applied on the hosted project so far: through `20261104000011_deck_details` (applied by hand; the file is re-runnable). **Pending since the security audit: `20261104000012_narrow_selftest_signup_exemption`** (tightens the Google-only sign-up guard; apply it before or together with the functions). New migrations: `supabase db push`, or paste the SQL in the dashboard.
2. **Edge Functions**: merge to `main` (workflow "Deploy Supabase Edge Functions" runs on pushes touching `supabase/functions/**`) or run it manually on a branch. 13 functions: account-delete, admin-ai-keys, admin-diagnose, asset-urls, deck-cancel, deck-process, deck-upload-complete, deck-upload-init, health, maintenance-sweep, ops-selftest, session-analyse, session-submit-init.
3. **Web app** (Netlify builds `main`).
4. **Verify** (section 5).

## 2. Supabase → Edge Functions → Secrets
| Secret | Notes |
|---|---|
| `INTERNAL_FUNCTION_SECRET` (≥ 16 chars), `APP_ALLOWED_ORIGINS` | origins: `http://localhost:3000` and the Netlify URL, comma separated |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2; the bucket CORS must allow the same origins |
| `GEMINI_SLIDE_MODEL` = `gemini-flash-lite-latest` | slide reading |
| `GEMINI_SLIDE_FALLBACK_MODEL` = `gemini-flash-latest` | optional but recommended |
| `GEMINI_SLIDE_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | Google AI Studio keys, ideally from different projects, billing enabled |
| `GEMINI_KEY_RPM_SOFT_LIMIT` | optional, default 30 (about 8 on the free tier) |
| `NVIDIA_REPORT_MODEL` = `nvidia/nemotron-3.5-lightning-30b-a3b` | report writing |
| `NVIDIA_REPORT_FALLBACK_MODEL` = `nvidia/nemotron-3.5-bolt-e4b` | optional but recommended |
| `NVIDIA_REPORT_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | build.nvidia.com keys |
| `NVIDIA_ASR_FUNCTION_ID`, `NVIDIA_ASR_MODEL_LABEL`, `NVIDIA_ASR_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | speech-to-text (Parakeet); same NVIDIA key can be used |
| `NVIDIA_KEY_RPM_SOFT_LIMIT`, `NVIDIA_KEY_DEFAULT_CREDIT_LIMIT` | optional (35 / 1000) |
Remove the retired `NVIDIA_SLIDE_MODEL` and `NVIDIA_SLIDE_KEY_*` secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## 3. Netlify (production context)
`NEXT_PUBLIC_DATA_MODE=supabase` (set in `netlify.toml`), plus in the Netlify UI: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. No server secrets on Netlify (a `SUPABASE_SERVICE_ROLE_KEY` here would fail the secrets scan, and the build refuses any secret-looking `NEXT_PUBLIC_*` variable). `netlify.toml` omits only the three public `NEXT_PUBLIC_*` keys from Netlify's secrets scan. Every page renders per request because the CSP carries a script nonce. Deploy previews run on the in-browser mock backend by design.

## 4. GitHub (Actions → secrets)
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`. CI needs no secrets. The browser jobs run on `ubuntu-24.04` (Playwright does not support 26.04 yet). The deploy workflow passes `--yes` (the CLI refuses to deploy non-interactively without it).

## 5. After deploying
1. `GET <supabase-url>/functions/v1/health` → `ok` (database, storage, a primary key for each purpose).
2. Admin → Diagnosis → "Run all presets": all five pass. Use "Key to test" to try each fallback key and the Model box to try a candidate model.
3. Admin → AI usage: each configured slot shows "Configured" with its last 4 characters; no slot cooling down.
4. One real run: upload a short PDF, fill the details, practise one slide, submit, open the report (playback, script and transcript).
5. Terms / Privacy: say that audience, goal and summary go to Google with the slides (owner's decision; not changed in code).

## 6. Known limits
- Slide reading uses one Gemini request per deck (images ≤ about 10 MB per request; the timeout is 30 s + 6 s per extra slide, at most 80 s).
- Playback of recordings exists only in the browser tab until the student leaves the report.
- A deck cancelled by the student does not refund the daily session.
