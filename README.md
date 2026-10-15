# Mock2Pitch

Rehearse presentations privately: upload a PDF deck, record each slide in a virtual jury room, get an AI feedback report. This repository contains **Phase 1 — the complete backend** (Supabase + Cloudflare R2 + NVIDIA AI pipeline), **Phase 2 — the complete frontend** (runs on a typed in-browser mock data layer) and **Phase 3 — the integration**: the UI talks to the real backend through a Supabase/R2 adapter behind the same `DataPort`, proven end to end with real-stack Playwright tests. Start with `PHASE-3-HANDOFF.md`, then `docs/phase-1/PHASE-1-HANDOFF.md` and `docs/phase-2/PHASE-2-HANDOFF.md`.

```
supabase/            migrations, seed.sql (local only), Edge Functions (+ _shared: pure TS used by Deno and Vitest)
app/, features/      Next.js 16 App Router pages + feature modules (Phase 2 UI)
components/, styles/ design system (ds/), app components, tokens/fonts
lib/                 env validation, Supabase clients, DataPort (lib/data: types, mock adapter), upload/recording helpers
e2e/                 Playwright journeys on the mock layer (desktop, mobile, a11y, WebKit smoke)
e2e-int/             Playwright integration specs against the real Supabase + R2 + NVIDIA stack (Phase 3)
tests/               unit · db (RLS/limits/policy) · functions (handlers) · r2 · live (opt-in)
infra/r2-cors.json   bucket CORS
scripts/             fixtures, type generation, NVIDIA spike, bundle scan, local Postgres helper
docs/phase-3/        integration results, security review, fillers, device checks, owner steps
docs/phase-2/        existing-state, frontend, fidelity, port map, handoff, reference + captured screens
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

### Running against the real backend (Phase 3)
```bash
cp .env.example .env.local     # set NEXT_PUBLIC_DATA_MODE=supabase, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key), NEXT_PUBLIC_APP_URL
npm run dev                    # http://localhost:3000, Google sign-in via Supabase Auth (see docs/phase-3/owner-steps.md)
npm run test:integration       # real-stack E2E (needs the @mock2pitch.test users; see e2e-int/README.md)
```
`NEXT_PUBLIC_DATA_MODE=supabase` builds contain no mock backend (checked by `scripts/check-prod-bundle.mjs`). Production = Netlify (`netlify.toml`); deploy previews run in mock mode. One Supabase project and one R2 bucket serve as production.

### Frontend (Phase 2, mock mode)
```bash
npm run dev:mock          # next dev --webpack with NEXT_PUBLIC_DATA_MODE=mock on :3100
```
Open the app and use the **Mock controls** panel (bottom corner, dev only) to switch persona (signed-out, new student, student with reports, at daily limit, blocked, owner admin…), speed up the AI stages and inject failures. A persona can also be seeded from the URL with `?persona=<id>` (see `docs/phase-2/frontend.md`). State lives in `sessionStorage`; closing the tab resets it. Production builds refuse to start in mock mode unless `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1` (used by `npm run build:review` for a review deploy); the dev panel and `window.__m2pMock` are compiled out of production bundles (`npm run check:prod-bundle`).

## Tests
```bash
scripts/pg-test-server.sh            # once, if no Postgres is running
npm test                             # everything except live AI
npm run test:unit | test:db | test:functions | test:r2
RUN_LIVE_AI_TESTS=1 npm run test:live-ai    # spends NVIDIA credits; needs the NVIDIA_* env
npm run test:frontend                # Phase 2 unit / component tests (jsdom)
npm run test:e2e                     # Playwright desktop-chrome (1280x800); :mobile = 390x844; test:a11y = axe sweep; test:webkit = smoke
npm run typecheck && npm run lint
npm run build && npm run scan:bundle        # Next build + client-bundle secret scan
npm run gen:types                           # regenerate types/database.ts from the migrations
npm run spike:nvidia                        # live model/latency/ASR spike report (needs keys + network)
```
Edge Function handlers are plain `(Request, Deps) => Response` functions in `supabase/functions/_shared/handlers/`; the `index.ts` in each function folder only wires Deno dependencies. Tests run the **same handlers** against real Postgres, a fake S3 that independently verifies SigV4 signatures, and a scriptable fake NVIDIA.

## Deploy
Owner steps (Google OAuth, R2 bucket + CORS, secrets, cron, owner allow-list): `docs/phase-1/owner-setup.md`. Netlify hosts the Next.js app (Phase 2/3); Supabase hosts the database and functions.
