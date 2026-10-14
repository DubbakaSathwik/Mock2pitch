# Phase 2 — existing state (inspected before building)

## Repository at the start of Phase 2 (`main` @ `309a627`)
- **Next.js 16 shell** (`app/layout.tsx`, `app/page.tsx` placeholder, `app/api/internal/transcribe/route.ts` — left untouched), webpack builds (`next dev --webpack`), `lib/env.ts` (Zod, client + server schemas), `lib/supabase/{browser,admin}.ts` (not used in Phase 2).
- **Shared code:** `supabase/functions/_shared/constants.ts` (limits, scoring, filler regex, branches/years), `_shared/scoring.ts` (`suggestedSeconds`, `countFillers`, score maths). Phase 2 imports these via the `@shared/*` alias — no constants are duplicated.
- **Types:** `types/database.ts` (tables and RPC signatures). `docs/phase-1/api-contracts.md` is the contract the data port mirrors.
- **Tooling:** TypeScript strict (`noUncheckedIndexedAccess`), ESLint flat config, Vitest (`tests/**/*.test.ts`, node environment), no Playwright, no React Testing Library, no component code.
- **Phase 1 status:** backend deployed and verified live (see `docs/phase-1/PHASE-1-HANDOFF.md`). Phase 2 does not touch it.

## Design handoff
It was **missing from the repo** (Phase 1 issue F1). The owner supplied `Mock2Pitch_1.zip`; its contents were placed at `docs/design-handoff/design_handoff_mock2pitch/` unchanged (prototype, design-system source, `CLAUDE_CODE_HANDOFF.md`, tokens, fonts, assets). Read in full: `CLAUDE_CODE_HANDOFF.md`, `design-system-source/components/**/*.jsx` (Button, IconButton, Icon, Badge, Card, Input, Select, Checkbox, Dialog, ProgressBar, Toast, Tooltip, Tabs, ScoreRing, LevelMeter, RecordButton), `tokens/*.css`, and the whole of `prototype/src/m2p-app.jsx` (all 25 screens, mock data, shells).

Facts that shaped the build:
- The prototype's styling is inline; the production code uses **CSS Modules + the unchanged token CSS** (values copied verbatim to `styles/tokens.css`).
- Fonts: Autour One 400, LXGW WenKai TC 400/700 (the 12 MB CJK TTFs are subset to Latin woff2 for the app). The Light 300 weight is not in the handoff and is not used by any screen, so it is not shipped.
- The Lucide **0.452.0** icon font is vendored in the prototype; the app uses `lucide-react@0.452.0` with an explicit map of the 55 icons used (no whole-library import).
- One breakpoint on the **container** width (< 760 px = mobile); the landing hero stacks below 1100 px.
- Prototype-only tools that must not ship: the "Screens" menu, "Prototype shortcuts" (Upload), "Demo: block it" (Mic check), "Fill with sample recordings" (Review).

## Reference screenshots
`docs/phase-2/reference/{desktop,mobile}/` — 37 images each (every screen/state incl. mic granted), captured from the running prototype at **1280×800** and **390×844** by `scripts/ref-screenshots.mjs` (Playwright driving the prototype's own Screens menu). The violet "Screens" button visible in the corner of those images is the prototype's jump menu, not part of the design.

## Differences between the prompt and the prototype that the build follows (prompt wins, §1.2/§1.3)
PDF only (not PPTX); real slide images instead of HTML-drawn slides; Pacing is information-only with 4 scored sub-scores; Delete account, Blocked screen, AI failure states, PowerPoint hint, "Use Chrome" note and the 10-minute recording cap are additions; Admin AI usage is 3 purposes × 3 key slots instead of 4 cards.
