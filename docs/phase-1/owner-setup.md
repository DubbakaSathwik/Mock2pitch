# Owner & environment setup (run by the project owner)

Nothing here is committed with real values. Do these once per environment.

## 1. Owner account (production owner: `dubbakasathwik@gmail.com`)
Run in the Supabase SQL editor (as `postgres`) — **never in a migration**:
```sql
insert into private.owner_allowlist (email) values ('dubbakasathwik@gmail.com') on conflict do nothing;
-- If the owner already signed in before this step:
select private.sync_owner_role('dubbakasathwik@gmail.com');
```
Then sign in once with Google. The role becomes `admin` only if Google reports the email as verified. Check: `select email, role from public.profiles where role='admin';`

## 2. Google sign-in (the only provider)
1. Google Cloud → APIs & Services → Credentials → OAuth client (Web). Authorised redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google: paste client id/secret, enable. **Disable the Email provider** (no email/password in production).
3. Authentication → URL configuration: Site URL = the Netlify URL; Redirect URLs = `http://localhost:3000/auth/callback`, `https://<site>.netlify.app/auth/callback` (+ custom domain).
4. Verify: an email/password sign-in attempt against the hosted project must be rejected.

## 3. Cloudflare R2 (user-created)
1. Create **private** buckets `mock2pitch-dev` / `mock2pitch-prod` (no public access, no `r2.dev` URL, no custom public domain).
2. R2 → Manage API tokens → *Object Read & Write*, scoped to that bucket → note `Access Key ID`, `Secret`, and the Account ID.
3. CORS (edit origins in `infra/r2-cors.json` first):
   `npx wrangler r2 bucket cors set mock2pitch-prod --file infra/r2-cors.json`
4. **Do not** add the prompt's "delete `users/*/sessions/` after 1 day" lifecycle rule: R2 lifecycle prefixes are literal (no wildcard), so a rule on `users/` would delete decks and slide images. The sweeper (`maintenance-sweep`) deletes audio after 24 h. See `r2.md` for the proposed layout change.

## 4. Supabase secrets and deploy
```bash
cp .env.example .env.local          # fill the Edge Function block
supabase link --project-ref <ref>
supabase db push                    # applies migrations
supabase secrets set --env-file .env.local
supabase functions deploy           # all functions
```
Generate `INTERNAL_FUNCTION_SECRET` with `openssl rand -hex 32`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## 5. Cron secrets (Vault)
```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_base_url');
select vault.create_secret('<same value as INTERNAL_FUNCTION_SECRET>', 'internal_function_secret');
select cron.schedule('maintenance-sweep', '*/15 * * * *', 'select private.invoke_maintenance_sweep()'); -- if migration 0007 skipped it
```

## 6. Netlify (Phase 2/3 will use these)
Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_TRANSCRIBE_SECRET`, If using Option B, set the Edge Function secrets `INTERNAL_TRANSCRIBE_URL=https://<site>/api/internal/transcribe` and the same `INTERNAL_TRANSCRIBE_SECRET`.

## 7. Reviewing the legal text
`policy_versions` v1.0 is a draft. Edit and publish your approved wording as `v1.1` via `select * from admin_publish_policy('v1.1', '<terms>', '<privacy>', 'note')` (or the Phase 2 admin screen). Everyone must then re-accept before starting anything new.
