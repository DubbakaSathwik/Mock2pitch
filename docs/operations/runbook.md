# Mock2Pitch runbook

Production = one Supabase project (`mkglxcdtfimgmvxtddst`), one R2 bucket (`mock2pitch-dev`), Netlify site (name in `HOSTED-STATE.md`), NVIDIA-hosted models. Costs: everything on free tiers; the only metered thing students can trigger is NVIDIA credits (5 sessions/day/student limit).

## 1. Health check (2 minutes)
| Where | What to look at |
|---|---|
| Netlify → Deploys | latest production deploy "Published"; no failed builds |
| Supabase → Edge Functions → each function → Logs | no 5xx bursts; `session_analysis_failed` events (codes only, no content) |
| Supabase → Database → Cron (or SQL below) | `maintenance-sweep` ran in the last 20 minutes and `succeeded` |
| Supabase → Reports / project home | not paused (free plan pauses after 7 days of inactivity) |
| App → sign in as owner → **Admin → AI usage** | each purpose has a "Configured" primary key; none "Cooling down" for long; "Running low" flags |
| Cloudflare → R2 → `mock2pitch-dev` | object count is roughly decks × (1 PDF + n images); no `audio` objects older than a day |

```sql
-- cron health (last 5 runs)
select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;
-- AI failures by purpose and slot, last 24 h
select l.purpose, s.slot, l.outcome, l.http_status, count(*) from ai_usage_log l left join ai_key_slots s on s.id = l.key_slot_id
 where l.created_at > now() - interval '24 hours' and l.outcome <> 'success' group by 1,2,3,4 order by 5 desc;
```
More queries: `monitoring.md`.

## 2. Playbooks

### 2.1 AI busy / 503 surge (students see "AI is busy")
1. Look at the failures query above. One purpose with `http_503` on one slot = provider hiccup; the router already retries once on the same key (1.5 s) and cools the slot for 30 s. Students are told to wait 30 s and press Try again; sessions keep their transcripts, so nothing is re-spent.
2. If it persists > 15 min: add a **fallback key** for that purpose (2.2) — the router rotates to it automatically.
3. Check https://status.nvidia.com / the NVIDIA developer forum for the model. Nothing to do on our side if the model is down; do not change `NVIDIA_*_MODEL` secrets without testing a call first.

### 2.2 NVIDIA key exhausted, revoked or rotated
Secret names (Supabase → Edge Functions → Secrets, or `supabase secrets set NAME=value --project-ref mkglxcdtfimgmvxtddst`):
`NVIDIA_SLIDE_KEY_{PRIMARY,FALLBACK_1,FALLBACK_2}`, `NVIDIA_ASR_KEY_{…}`, `NVIDIA_REPORT_KEY_{…}`.
1. Create the key at build.nvidia.com (same account or a second account for more rate limit).
2. Set the secret. Functions pick it up on the next cold start (≤ a few minutes; redeploy the function to force it: Actions → "Deploy Supabase Edge Functions" → Run workflow).
3. Admin → AI usage must show the slot as **Configured** with the last four characters of the new key.
4. A revoked key shows as 401/403 in the failures query and the slot is cooled down for the auth cooldown; once replaced, clear it by waiting out the cooldown or running `update ai_key_slots set cooldown_until = null, last_error_code = null where purpose = '<purpose>' and slot = '<slot>';`.
5. Never paste keys into chat, issues or git. If one leaks, revoke it at NVIDIA first, then replace.

### 2.3 R2 outage or CORS break (uploads fail in the browser, images do not load)
1. Cloudflare status page. If R2 is up, open DevTools on the failing upload: a CORS error means the bucket CORS no longer matches the site origin.
2. Reapply `infra/r2-cors.json` (R2 → bucket → Settings → CORS policy). The origin list must be exactly: the production site origin and `http://localhost:3000`.
3. Students' decks/reports are never lost by an R2 outage: the upload flow re-requests URLs and resumes without consuming another daily session.

### 2.4 Google sign-in broken
1. Supabase → Authentication → Providers → Google: enabled, client id/secret present. Google Cloud → OAuth client: redirect URI is exactly `https://mkglxcdtfimgmvxtddst.supabase.co/auth/v1/callback`; consent screen status "In production".
2. Supabase → Authentication → URL Configuration: Site URL = production origin; Redirect URLs contain `<origin>/auth/callback`.
3. Error codes on the sign-in page: `oauth` = user denied or provider error; `oauth_not_configured` = the deploy is in mock mode (check `NEXT_PUBLIC_DATA_MODE` on Netlify).
4. Sign-up is Google-only by design (Auth hook + DB guard). A "Sign-up is only available with Google" message for an email sign-up is expected.

### 2.5 Stuck sessions or decks
The sweeper (every 15 min) already: fails decks waiting > 1 h for uploads; returns sessions stuck in `uploading_audio` > 1 h to `in_progress` (deleting their clips); resumes stuck analyses; abandons never-submitted sessions after 24 h; deletes audio older than 24 h. A student who is rejected on audio or abandons an upload is also released immediately / at the next submit. If something is stuck anyway:
```sql
-- what is stuck?
select id, owner_id, status, error_code, analysis_attempts, updated_at from practice_sessions where status in ('uploading_audio','transcribing','generating_report') and updated_at < now() - interval '15 minutes';
select id, owner_id, status, processing_stage, error_code, updated_at from decks where status in ('processing','awaiting_upload','awaiting_images') and updated_at < now() - interval '15 minutes';
-- safe release of an uploading_audio session (the student can submit again)
update practice_sessions set status = 'in_progress' where id = '<session id>' and status = 'uploading_audio';
-- run the sweeper now (needs the internal secret; or wait ≤ 15 min)
```
Never delete rows by hand; use the student's own Delete account or the procedure in 2.6.

### 2.6 A user asks for their data to be deleted
Preferred: the student uses Settings → Delete account (removes R2 prefix `users/<id>/`, the auth user and every row; `ai_usage_log` keeps anonymous rows).
If they cannot sign in: ask the owner to (1) note the user id from Admin → Students, (2) call the `account-delete` function as that user is not possible without their token, so instead: Supabase → Authentication → Users → delete the user (cascades all rows) **after** deleting the R2 prefix `users/<id>/` in the Cloudflare dashboard. Record the request date.

### 2.7 Blocking an abusive user
Admin → Students → Block. The student keeps read access to their reports, all writes are refused, the UI shows "Your account is paused". Unblock the same way. Blocking never deletes data.

### 2.8 Rolling back a bad deploy
- **Frontend:** Netlify → Deploys → pick the last good deploy → "Publish deploy" (instant). Then revert the commit on `main`.
- **Edge Functions:** Actions → "Deploy Supabase Edge Functions" → Run workflow on the last good commit/branch (functions are versioned by redeploy; there is no in-dashboard rollback).
- **Database:** migrations are forward-only. Write a **corrective migration** (`supabase/migrations/<ts>_fix_<what>.sql`, additive: `create or replace function …`, `alter table … add column if not exists …`, never `drop`/`truncate` on production data), test it with `npm run test:db`, apply it with the Supabase tool or `supabase db push`, and note it in `HOSTED-STATE.md`.

## 3. Test accounts on production (regression runs)
`node scripts/integration/provision-test-users.mjs` prints SQL (run in the SQL editor; Email provider must be enabled temporarily — the hook and DB guard keep public sign-up Google-only) and writes `.env.integration.local`. Run `INTEGRATION_BASE_URL=https://<site> npm run test:integration` (credit budget and spec order in `e2e-int/README.md`). Clean up: demote the admin (`update profiles set role='student' where email='it.admin@mock2pitch.test'`), run `node scripts/integration/cleanup-via-api.mjs`, check the residue query in `docs/phase-3/integration.md`, turn the Email provider off again.
