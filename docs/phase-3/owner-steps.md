# Owner steps for Phase 3 (click-by-click)

Single environment: **one** Supabase project (`mkglxcdtfimgmvxtddst`) and **one** R2 bucket (`mock2pitch-dev`) serve as production (owner decision, 2026-10-15). Test runs therefore touch production data: they use only `@mock2pitch.test` users and delete everything they create.

## A. Google Cloud
1. console.cloud.google.com → project "Mock2Pitch" → APIs & Services → OAuth consent screen (Google Auth Platform).
2. App name Mock2Pitch, support email, audience External. While in *Testing*, add the owner Google account and a second Google account as test users. Scopes: `openid`, `email`, `profile`.
3. Credentials → Create credentials → OAuth client ID → Web application. Authorized JavaScript origins: `http://localhost:3000` and the Netlify production URL. Authorized redirect URI: `https://mkglxcdtfimgmvxtddst.supabase.co/auth/v1/callback`.
4. Copy the Client ID and Client secret into Supabase (B1). Before launch: OAuth consent screen → Publish app (so non-test users can sign in).

## B. Supabase dashboard
1. Authentication → Sign In / Providers → Google: enable, paste Client ID/secret.
2. Same page → Email: enabled **only while automated tests run** (the hook below blocks all non-Google sign-ups). Turn it off before launch.
3. Authentication → Hooks → Before User Created → Postgres function `public.hook_before_user_created` (migration `20261015000009`).
4. Authentication → URL Configuration: Site URL = the Netlify production URL (`http://localhost:3000` until it exists). Redirect URLs: `http://localhost:3000/auth/callback`, `https://<site>.netlify.app/auth/callback` (+ custom domain). No wildcards.
5. Edge Functions → Secrets: `APP_ALLOWED_ORIGINS` = `http://localhost:3000,https://<site>.netlify.app`; `NVIDIA_SLIDE_MODEL` = `meta/llama-3.2-11b-vision-instruct`.

## C. Cloudflare R2 CORS
Replace the placeholder origin in `infra/r2-cors.json` with the real Netlify origin, then R2 → bucket `mock2pitch-dev` → Settings → CORS policy → paste the JSON (or `npx wrangler r2 bucket cors set mock2pitch-dev --file infra/r2-cors.json`).

## D. Netlify (after the PR is merged)
1. app.netlify.com → Add new site → Import an existing project → GitHub → `DubbakaSathwik/Mock2pitch`, branch `main`.
2. Build command `npm run build`, publish directory `.next` (the Next.js runtime is detected automatically). Node 22 (set `NODE_VERSION=22`).
3. Site configuration → Environment variables (Production context): `NEXT_PUBLIC_DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL=https://mkglxcdtfimgmvxtddst.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`, `NEXT_PUBLIC_APP_URL=https://<site>.netlify.app`. Deploy-preview context: `NEXT_PUBLIC_DATA_MODE=mock`, `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1` (and the same URL/key variables are not needed).
4. Do **not** set `SUPABASE_SERVICE_ROLE_KEY` or `INTERNAL_TRANSCRIBE_SECRET`.
