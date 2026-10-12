# Setup steps for the owner (in order)

Legend: **[DONE]** already done for you · **[YOU]** needs your account/browser · **[ME]** I can do it once you reply.

## Part 0 — What is already done
- **[DONE]** Supabase project `mkglxcdtfimgmvxtddst`: all 8 migrations applied, advisors run (see `HOSTED-STATE.md`), owner e-mail `dubbakasathwik@gmail.com` allow-listed.
- **[DONE]** Cloudflare R2 bucket **`mock2pitch-dev`** created (private).
- **[DONE]** Repo pushed to branch `claude/sleepy-rubin-mm8mb1`.

## Part 1 — Cloudflare R2 (point 2)
I could create the bucket, but the tools I have cannot create API tokens, read your Account ID, or set CORS. Do these three things:

1. **Account ID** — Cloudflare dashboard → *Storage & databases* → **R2 object storage** → *Overview*. The 32-character "Account ID" is shown on the right side (also in the S3 API URL `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`). → this is `R2_ACCOUNT_ID`.
2. **API token (the Access Key)** — same R2 Overview page → *Account Details* → **API Tokens → Manage** → **Create Account API token**.
   - Name: `mock2pitch-dev-functions`
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **only `mock2pitch-dev`**
   - TTL: leave as "Forever" (or set a reminder to rotate)
   - Create. The next screen shows **Access Key ID** and **Secret Access Key** **once** — copy both now. → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. (Ignore the "Token value" and the endpoint URLs.)
3. **CORS** (lets the browser upload straight to R2) — R2 → bucket **mock2pitch-dev** → *Settings* → **CORS Policy → Add CORS policy → JSON tab** → paste → *Save*:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   When the Netlify site exists, add its exact origin (e.g. `"https://mock2pitch.netlify.app"`) to `AllowedOrigins` — no `*`, no trailing slash, no path. (The same policy for the Wrangler CLI is in `infra/r2-cors.wrangler.json`.)
4. Leave **Public access** disabled (do not enable the `r2.dev` URL, do not connect a custom domain). Do **not** add an object-lifecycle rule (see `r2.md`: it cannot be scoped to audio and would delete decks).

## Part 2 — NVIDIA (point 3)
The backend needs **3 purposes × 3 keys = 9 key slots** (`primary`, `fallback_1`, `fallback_2`), but it works with **only the primary key per purpose** (empty slots are skipped). You can even start with one key reused for all three primaries.

1. Go to <https://build.nvidia.com> and sign in (NVIDIA Developer account; free).
2. **Create API keys**: open any model page → **Get API Key** (or profile menu → *API Keys*) → *Generate Key*. Name them so you can tell them apart, e.g. `m2p-slide-primary`, `m2p-slide-fb1`, … Each key looks like `nvapi-…` and is shown once.
   - **Important caveat:** keys created under the *same* NVIDIA account normally share that account's credits and rate limits, so extra keys add resilience (rotation if one is revoked/auth-fails) but **not** extra capacity. For genuine overflow capacity the fallbacks must come from a different NVIDIA account. I could not verify NVIDIA's current policy (the site is blocked from my environment) — please check your account's *Usage/Credits* page.
3. **Speech-to-text function ID**: build.nvidia.com → search **parakeet-tdt-0.6b-v2** (ASR, English) → open it → **Try API** / *Deploy → Python (gRPC)* tab. Find the line `--metadata function-id "<uuid>"` (or `function-id` in the sample code). Copy the UUID → `NVIDIA_ASR_FUNCTION_ID`. The same `nvapi-` key authorises it.
4. **Confirm the two chat models exist for your key** (I defaulted to `meta/llama-4-maverick-17b-128e-instruct` for slide reading and `nvidia/nemotron-3-ultra-550b-a55b` for the report). On build.nvidia.com search each name; the model page shows the exact id in the sample code (`model="…"`). If a name is missing or marked deprecated, pick the fallback listed in `docs/phase-1/spikes.md` and tell me.
5. Write down (to give me, or to paste yourself):

| Variable | What |
|---|---|
| `NVIDIA_SLIDE_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | keys for reading slides |
| `NVIDIA_ASR_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | keys for speech-to-text |
| `NVIDIA_REPORT_KEY_PRIMARY` / `_FALLBACK_1` / `_FALLBACK_2` | keys for the report |
| `NVIDIA_ASR_FUNCTION_ID` | the UUID from step 3 |

## Part 3 — Supabase secrets (how the values reach the functions)
Safest: **you type secrets in the Supabase dashboard**, never in chat.
- Dashboard → project **Mock2Pitch** → *Edge Functions* → **Secrets** → *Add new secret* (or paste a whole `.env` block with **Add or replace secrets**).
- Or tell me "set the secrets" and I will call the Supabase tool that opens a prompt for each secret **where you enter the value; it never passes through me**.

Paste this block (fill the blanks; the first group is non-secret and already correct):
```
R2_BUCKET=mock2pitch-dev
APP_ALLOWED_ORIGINS=http://localhost:3000
NVIDIA_SLIDE_MODEL=meta/llama-4-maverick-17b-128e-instruct
NVIDIA_REPORT_MODEL=nvidia/nemotron-3-ultra-550b-a55b
NVIDIA_ASR_MODEL_LABEL=parakeet-tdt-0.6b-v2
NVIDIA_KEY_RPM_SOFT_LIMIT=35
NVIDIA_KEY_DEFAULT_CREDIT_LIMIT=1000
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
NVIDIA_ASR_FUNCTION_ID=
NVIDIA_SLIDE_KEY_PRIMARY=
NVIDIA_ASR_KEY_PRIMARY=
NVIDIA_REPORT_KEY_PRIMARY=
INTERNAL_FUNCTION_SECRET=
```
(Add the `_FALLBACK_1/_2` keys if you have them. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do **not** add them.)
`INTERNAL_FUNCTION_SECRET`: any random string of 32+ characters (e.g. run `openssl rand -hex 32`, or use a password manager). Keep a copy: you need the same value in Part 5.

Speech-to-text path: leave `INTERNAL_TRANSCRIBE_URL` **unset** to try the in-process gRPC option first (default). If speech-to-text fails inside Supabase, we switch to the Netlify route (set `INTERNAL_TRANSCRIBE_URL` + `INTERNAL_TRANSCRIBE_SECRET`) — recommended fallback, documented in `spikes.md`.

## Part 4 — Deploy the Edge Functions
Pick one:
- **A. GitHub Actions (no local tools)** — [YOU] create a Supabase access token (dashboard → *Account → Access Tokens → Generate new token*), add two repo secrets in GitHub (*Settings → Secrets and variables → Actions*): `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` = `mkglxcdtfimgmvxtddst`; then *Actions → Deploy Supabase Edge Functions → Run workflow*. (Workflow: `.github/workflows/deploy-supabase-functions.yml`, if it was pushed — see below.)
- **B. Your own computer** — install the Supabase CLI, then: `supabase login` · `supabase link --project-ref mkglxcdtfimgmvxtddst` · `supabase functions deploy`.
After deploy, check the dashboard → *Edge Functions* lists 9 functions.

## Part 5 — Turn on the 15-minute cleanup job (Vault)
Supabase dashboard → *SQL Editor* → run (use your real secret):
```sql
select vault.create_secret('https://mkglxcdtfimgmvxtddst.supabase.co/functions/v1', 'functions_base_url');
select vault.create_secret('<the same INTERNAL_FUNCTION_SECRET>', 'internal_function_secret');
```
The cron job already exists; it starts working as soon as these two rows exist.

## Part 6 — Google sign-in
1. <https://console.cloud.google.com> → create/select a project → **APIs & Services → OAuth consent screen** (External; app name Mock2Pitch; support e-mail; add your own Google account as a test user while in "Testing"; publish later).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URI: `https://mkglxcdtfimgmvxtddst.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins: `http://localhost:3000` (+ the Netlify URL later).
   Copy the **Client ID** and **Client secret**.
3. Supabase → *Authentication → Sign In / Providers* → **Google** → paste both → enable → Save. Same page: **disable Email** (Google-only).
4. *Authentication → URL Configuration*: Site URL = your Netlify URL (use `http://localhost:3000` until it exists); Redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-site>.netlify.app/auth/callback`.
5. Phase 2 provides the login button; after that, sign in once with `dubbakasathwik@gmail.com` and check in SQL: `select email, role from public.profiles;` → role must be `admin`.

## Part 7 — Verify (I will do these with you)
1. Reply with what you finished (never paste secrets unless you prefer to).
2. [ME] `npm run spike:nvidia` and `RUN_LIVE_AI_TESTS=1 npm run test:live-ai` — **only possible if my environment gains network access to NVIDIA** (currently blocked). If it stays blocked, we run the same two commands on your computer or in GitHub Actions and you paste me the output.
3. [ME/YOU] Call the deployed functions with a test user and run the full flow once (upload a 3-slide PDF → process → record → report).
