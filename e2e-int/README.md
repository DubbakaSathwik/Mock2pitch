# Integration E2E (real Supabase + R2 + NVIDIA)

One Supabase project and one R2 bucket are production (owner decision), so these tests: use only `@mock2pitch.test` users; use the smallest
fixtures (3-page PDF, ~5 s clips); cap complete analyses (default budget: ≤ 6 per run); delete everything they create (account-delete flow
+ `scripts/integration/provision-test-users.mjs --cleanup` residue query); and report AI credits from `ai_usage_log`.

Setup: `node scripts/integration/provision-test-users.mjs` (writes `.env.integration.local`, prints SQL to run once), then
`npm run test:integration` (local dev server in supabase mode) or `INTEGRATION_BASE_URL=https://<site>.netlify.app npm run test:integration`.
Before launch: Authentication → Providers → Email can be switched off again (the Google-only hook stays).

## Student B's seeded usage (specs 03 and 06)
Spec 06 needs B at the daily limit; spec 03 needs B to have sessions left. B's five `usage_events` are therefore *parked* on 2026-01-01 and
moved to today only for spec 06 (non-destructive UPDATEs):

```sql
-- before spec 06
update usage_events set created_at = now(), local_date = (now() at time zone 'Asia/Kolkata')::date where user_id = '00000000-0000-4000-8000-000000001703';
-- after spec 06 (park again)
update usage_events set created_at = '2026-01-01 00:00:00+00', local_date = '2026-01-01' where user_id = '00000000-0000-4000-8000-000000001703';
```
Other notes: spec 07 can run as a fresh user with `IT_07_USER=DEL`; test users re-accept a newer policy automatically (except NEW).
