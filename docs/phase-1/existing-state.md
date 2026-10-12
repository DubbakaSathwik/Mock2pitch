# Existing state (inspected at the start of Phase 1)

## Repository
- `git log`: one commit, "Add initial README with mock2pitch". The working tree contained **only `README.md`** (the text `mock2pitch`).
- Branches: `main` and the working branch `claude/sleepy-rubin-mm8mb1` (identical at start).
- No `package.json`, Next.js app, `supabase/` folder (config, migrations, functions, seed), Cloudflare/R2 config (`wrangler.toml`, CORS), Edge Functions, tests, env files or `.gitignore`.
- **Supabase Storage is not used anywhere** (R2 is the only file store). Storage is disabled in `supabase/config.toml`.
- Nothing existing was overwritten or removed.

## Design handoff — NOT FOUND
`docs/design-handoff/`, `CLAUDE_CODE_HANDOFF.md`, `prototype/src/m2p-app.jsx` and `design-system-source/` do not exist in the repository, and a filesystem search found none of them. Consequences (all listed in the handoff under "Open questions"):
- The legal text could not be copied from `TERMS0` / `PRIV0`. `policy_versions` v1.0 is a **draft written from the locked decisions** (see `docs/phase-1/PHASE-1-HANDOFF.md` §F). The owner must review it and publish an approved revision.
- The "ParkSense" sample in `supabase/seed.sql` is synthetic, not the handoff's data.
- Data shapes (`SL`, `REPORT`, `STUDENTS`, `RATINGS`, `AI`) were taken from the Phase 1 prompt, not from `m2p-app.jsx`. Phase 2 should reconcile field names against the prototype.

## Environment this phase was built in
| Item | State |
|---|---|
| Node / npm | 22.22.0 / 10.9.4 (Next.js shell on 16.4, React 19) |
| Docker | daemon can start, but image pulls from Docker Hub / ECR / GHCR fail (rate limit, data limit, 403). **`supabase start` is impossible here.** |
| Supabase CLI | 2.120.0 via npm (works for `init`, `functions`, type tooling that needs no Docker) |
| Deno | 2.9.6 via npm (used for `deno check` and real-runtime smoke tests) |
| Postgres | a local PostgreSQL **16.15** server (Supabase hosted is 17) used for DB, RLS and function tests |
| Egress | `integrate.api.nvidia.com`, `deno.land` and GitHub release downloads are blocked by the sandbox proxy. npm registry and `raw.githubusercontent.com` work. **No live NVIDIA call was possible.** |
| Supabase (hosted) | The account has an **empty** project "Mock2Pitch" (`mkglxcdtfimgmvxtddst`, ap-northeast-1, Postgres 17.11) and an inactive "bot test" project. **Neither was modified.** |
| Cloudflare | `r2_buckets_list` returned 0 buckets. **No bucket or token exists yet.** |
| Credentials | none provided (Supabase keys, R2 token, NVIDIA keys, Google OAuth) |
