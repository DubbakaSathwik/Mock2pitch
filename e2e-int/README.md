# Integration E2E (real Supabase + R2 + NVIDIA)

One Supabase project and one R2 bucket are production (owner decision), so these tests: use only `@mock2pitch.test` users; use the smallest
fixtures (3-page PDF, ~5 s clips); cap complete analyses (default budget: ≤ 6 per run); delete everything they create (account-delete flow
+ `scripts/integration/provision-test-users.mjs --cleanup` residue query); and report AI credits from `ai_usage_log`.

Setup: `node scripts/integration/provision-test-users.mjs` (writes `.env.integration.local`, prints SQL to run once), then
`npm run test:integration` (local dev server in supabase mode) or `INTEGRATION_BASE_URL=https://<site>.netlify.app npm run test:integration`.
Before launch: Authentication → Providers → Email can be switched off again (the Google-only hook stays).
