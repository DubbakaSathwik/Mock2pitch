# Mock2Pitch

Rehearse presentations privately: upload a PDF deck, record each slide in a virtual jury room, get an AI feedback report. This repository currently contains **Phase 1 — the complete backend** (Supabase + Cloudflare R2 + NVIDIA AI pipeline). The product UI is Phase 2; wiring is Phase 3. Start with `docs/phase-1/PHASE-1-HANDOFF.md`.

```
supabase/            migrations, seed.sql (local only), Edge Functions (+ _shared: pure TS used by Deno and Vitest)
app/, lib/           minimal Next.js 16 shell: env validation, Supabase clients, internal transcribe route
tests/               unit · db (RLS/limits/policy) · functions (handlers) · r2 · live (opt-in)
infra/r2-cors.json   bucket CORS
scripts/             fixtures, type generation, NVIDIA spike, bundle scan, local Postgres helper
docs/phase-1/        architecture, supabase, r2, ai, api-contracts, security-review, owner-setup, spikes, handoff
```

## Prerequisites
Node ≥ 20 · npm · (for the real stack) Docker + Supabase CLI · a Cloudflare account · NVIDIA keys. Tests additionally need a local PostgreSQL ≥ 15 with `citext` and `pgcrypto` (`scripts/pg-test-server.sh`) — they do **not** need Docker. `ffmpeg` is needed only to regenerate fixtures.

## Install and configure
```bash
npm install
cp .env.example .env.local   # fill in values; see comments inside
```
Variables are validated with Zod at startup: `lib/env.ts` (Next.js, split into `clientEnv`/`serverEnv`) and `supabase/functions/_shared/env.ts` (Edge Functions). A missing variable fails fast with its **name**, never its value. Where each is set: `docs/phase-1/PHASE-1-HANDOFF.md` §H.

## Run
```bash
supabase start && supabase db reset                       # local stack + migrations + seed (needs Docker)
supabase functions serve --env-file .env.local            # Edge Functions
npm run dev                                               # Next.js shell on :3000
```
Local test accounts (email/password, local only) are in the handoff §I.

## Tests
```bash
scripts/pg-test-server.sh            # once, if no Postgres is running
npm test                             # everything except live AI
npm run test:unit | test:db | test:functions | test:r2
RUN_LIVE_AI_TESTS=1 npm run test:live-ai    # spends NVIDIA credits; needs the NVIDIA_* env
npm run typecheck && npm run lint
npm run build && npm run scan:bundle        # Next build + client-bundle secret scan
npm run gen:types                           # regenerate types/database.ts from the migrations
npm run spike:nvidia                        # live model/latency/ASR spike report (needs keys + network)
```
Edge Function handlers are plain `(Request, Deps) => Response` functions in `supabase/functions/_shared/handlers/`; the `index.ts` in each function folder only wires Deno dependencies. Tests run the **same handlers** against real Postgres, a fake S3 that independently verifies SigV4 signatures, and a scriptable fake NVIDIA.

## Deploy
Owner steps (Google OAuth, R2 bucket + CORS, secrets, cron, owner allow-list): `docs/phase-1/owner-setup.md`. Netlify hosts the Next.js app (Phase 2/3); Supabase hosts the database and functions.
