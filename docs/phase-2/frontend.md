# Phase 2 — frontend guide

Run it: `NEXT_PUBLIC_DATA_MODE=mock npm run dev` (also the default) → http://localhost:3000. Everything runs against the in-browser **mock backend**; nothing talks to Supabase or R2.

## Stack
Next.js 16 App Router (webpack) · React 19 · TypeScript strict · CSS Modules + the handoff's design tokens (`styles/tokens.css`, values unchanged) · `lucide-react@0.452.0` (explicit map of the icons used) · TanStack Query · Zod · `pdfjs-dist` (legacy build, lazy, client-only) · Vitest + React Testing Library · Playwright + axe.

## Structure
```
app/                       routes (see table) · layout.tsx (fonts, tokens) · providers.tsx (Query, Toast, Compact, dev panel)
  (guest)/                 /, /sign-in, /terms, /privacy                 public
  (onboarding)/onboarding/ terms, profile                               signed-in student, policy/profile exempt
  (app)/                   dashboard, practice/*, session/*, reports/*, history/*, settings, limit, paused   StudentGate in layout
  admin/sign-in            owner sign in                                 public
  admin/(console)/         overview, students(/[userId]), ratings, ai-usage, terms   AdminGate in layout
  dev/design-system/page.dev.tsx   exists only outside production builds
  auth/callback/route.ts   placeholder (Phase 3)
components/ds/             design-system components (Button, IconButton, Icon, Badge, Card, ProgressBar, ScoreRing, Input, Select, Checkbox, Dialog, Toast, Tooltip, Tabs, LevelMeter, RecordButton)
components/app/            app components (Logo, Typography, Tile, AIBadge, GoogleButton, Stars/StarRating, Avatar, SlideView, LineChart, BarChart, Person/SelfTile, Stat, Doc, FillerText, MicMeter, Notice, shells, Gate, Compact, Loading)
components/dev/            mock control panel (dev only)
features/<area>/           queries.ts (TanStack hooks over the port) + the screens of that area
lib/data/                  types.ts / ports.ts (the port), errors.ts, index.ts (getData), mock/ (adapter), supabase/ (README stub)
lib/                       env.ts (dataMode), format.ts (m:ss, en-IN dates, IST), score.ts, query.ts, upload/put.ts, flash.ts
```

### Routes
| Route | Screen | Guard |
|---|---|---|
| `/` | S1 Landing | – |
| `/sign-in`, `/admin/sign-in` | S2 / A0 | already signed in → destination |
| `/terms`, `/privacy` | S3 view-only (`?from=settings\|landing` for Back) | public |
| `/onboarding/terms`, `/onboarding/profile` | S3 first time / updated, S4 | signed-in student |
| `/dashboard` | S5 | student |
| `/practice/new` · `/practice/[deckId]/reading` · `/prepare` · `/time` | S6 · S7 · S8 · S9 | student |
| `/session/[id]/mic` · `/room` · `/review` · `/analysing` | S10 · S11 · S12 · S13 | student (policy-exempt) |
| `/reports/[id]` | S14 | student (read-only when blocked) |
| `/history`, `/history/[deckId]` | S15, S16 | student (read-only when blocked) |
| `/settings` | S17 (+ Delete account) | student (read-only when blocked) |
| `/limit`, `/paused` | S18, blocked screen | student |
| `/admin`, `/admin/students`, `/admin/students/[userId]`, `/admin/ratings`, `/admin/ai-usage`, `/admin/terms` | A1–A6 | admin |

### Guards (`features/guards/gate.ts`, pure functions, unit-tested)
Student: signed out → `/sign-in?next=…` · admin → `/admin` · blocked → `/paused` (History, reports, settings, paused stay readable) · policy not accepted → `/onboarding/terms?next=…` · profile incomplete → `/onboarding/profile?next=…`. `/session/*` is exempt from the policy gate: an in-progress session is never interrupted. Admin: signed out → `/admin/sign-in`, student → `/dashboard`. Until the session, profile and policy status are known the gate renders a neutral loading shell (no protected content). The acceptance status is re-checked on every navigation, so a policy published mid-session shows the "updated" Terms screen on the **next** navigation outside `/session/*`. `?next=` only accepts same-origin app paths (`lib/safe-next.ts`).

## Responsive model
One breakpoint, **container width < 760 px** (`#m2p-root` has `container: app / inline-size`). Pure styling uses CSS container queries (`@container app (max-width: 759.98px)`); `useCompact()` is used only where the **structure** differs (bottom tab bars, practice-room bottom sheet, prep toggle, tables → cards). The landing hero also stacks below 1100 px. Content widths: 1200 (report 1000, settings 860, flow 760, prep 1280). Touch targets ≥ 44 px on mobile (small buttons and pills grow under the breakpoint).

## Data port (`lib/data/types.ts`)
`DataPort = { auth, profile, policy, dashboard, decks, upload, sessions, reports, realtime, account, admin }`, each method named after the Phase 1 contract it maps to (table in `PHASE-2-HANDOFF.md` §N). Components never call an adapter: they use `features/*/queries.ts`, which wrap the port with TanStack Query (query keys in `lib/query.ts`, invalidation after mutations, optimistic pin and block/unblock with rollback). Errors are normalised to `AppError { code, message, details }`; `features/errors/map.ts` maps **every** backend code to a screen or an inline message (a `Record<ErrorCode, …>`, so a missing code is a compile error, and a unit test covers all of them).

### Mock adapter (`lib/data/mock`)
In-memory (persisted in `sessionStorage`, so a refresh keeps the session; recordings and slide object-URLs are not persisted). It simulates: configurable latency, every error code in the contract, the exact Realtime stage strings (`Waiting for slide images` → `Reading slide k of N`; `Transcribing your recording` → `Transcribed k of m` → `Writing your report`), the IST daily limit, policy republishing and re-acceptance, block/unblock, pin ordering, rate-once, account deletion and empty states.
It exercises the **real** browser code paths: uploaded PDFs are opened with pdf.js (page count, encryption, corruption, text), slide JPEGs are rendered by the real renderer and stored, clips are real 16 kHz mono WAVs validated with the Phase 1 `parseWav`, and report scores use the real `_shared/scoring.ts` functions on generated transcripts. PUTs to `mock://` URLs enforce the signed Content-Type and length like R2. Only the AI text is generated deterministically.

| Persona | State |
|---|---|
| `signed_out` | Landing, sign-in, Terms/Privacy only; Google sign-in becomes `new_student` (or the owner via the owner page) |
| `new_student` | must accept Terms, then complete the profile |
| `student` | onboarded, no history |
| `returning_student` | ParkSense, 2 reports (62 → 74), 2 of 5 sessions used today |
| `at_limit` | 5 of 5 used today |
| `blocked` | paused, history readable |
| `admin` | Owner: 10 students, 8 ratings, AI usage for 3 purposes × 3 key slots, 3 policy versions |

**Dev control panel** (`components/dev/MockPanel.tsx`, bottom-left "Mock" button, dev builds only): switch persona, republish Terms, fail the next upload PUT, expire slide URLs once, arm an AI failure for the next deck-processing or analysis call (`ai_unavailable`, `report_invalid`, `processing_failed`, `analysis_failed`, `audio_invalid`), change latency/stage speed/realtime, reset. The same hooks are on `window.__m2pMock` (dev only) for the E2E tests.

**Production builds** fail fast with `NEXT_PUBLIC_DATA_MODE=mock` unless `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1` (review deploys). The panel, `window.__m2pMock` and the `/dev/design-system` route (a `*.dev.tsx` page) are removed from production builds (`npm run check:prod-bundle`).

## Browser capabilities
* **PDF** (`features/upload/pdf.ts`): pdf.js worker, page count, password/corruption detection, page → JPEG following the server's `rules` (`features/upload/jpeg-rules.ts`: quality 0.8 → 0.5 at 1280 px, then width down to 800 px until ≤ 1,000,000 bytes; pure and unit-tested). The **legacy** pdf.js build is used because pdfjs-dist 6 needs very new JS features (`Map.prototype.getOrInsertComputed`) that current Chrome does not all have.
* **Recording** (`features/recording`): `getUserMedia` with echo cancellation / noise suppression / auto gain, one `MediaRecorder` per slide (webm/opus or mp4/aac by `isTypeSupported`), live level via `AnalyserNode` every ~120 ms, durations from `performance.now()`, hard stop at 10:00 (toast), playback through object URLs. Clips live in an in-memory store and are revoked (and the microphone released) as soon as the route leaves `/session/*`.
* **WAV** (`wav.ts`): decode → mono → `OfflineAudioContext` resample to 16 kHz → 16-bit PCM RIFF; the pure encoder is validated against the Phase 1 server checker.
* **Upload** (`lib/upload/put.ts`): XHR PUT with progress and abort, never sets `Content-Length`; submit uploads all clips with per-clip progress and a retry that re-sends only the failed ones.
* **Realtime** (`features/realtime/watch.ts`): fetch the current row, subscribe, and fall back to polling every 3 s after 10 s without an event.
* **Feature detection** (`capabilities.ts`): unsupported browsers get a message, never a crash; non-Chromium browsers get a non-blocking "Use Chrome for the best results".

## Accessibility
Landmarks + one `h1` per screen, skip link, 3 px focus ring, Dialog with focus trap/Esc/focus return, `aria-live` for stage text/toasts/recording state (overrun announced once), star rating as a five-button radio group, charts with text alternatives (summary label + hidden table), colour never the only signal, `prefers-reduced-motion` honoured. Contrast refinements (handoff tokens untouched; extra aliases in `styles/globals.css`): muted text `#5A6080`, success/danger text on tinted badges `#157A53` / `#B83232`, warning score numbers `#A86400` — the originals measured 2.8–4.5:1.

## Commands
```bash
npm run dev:mock | build:review | check:prod-bundle | scan:bundle
npm run test:frontend      # Vitest: units, mock adapter, RTL components   (tests/frontend)
npm run test:e2e           # Playwright desktop Chrome journeys              (e2e)
npm run test:e2e:mobile    # same journeys at 390×844, touch
npm run test:a11y          # axe on every screen/state, desktop + mobile, and the horizontal-scroll sweep
npm run test:webkit        # WebKit smoke (needs the WebKit browser installed)
npm run ref:screenshots    # re-capture the prototype reference images
```
