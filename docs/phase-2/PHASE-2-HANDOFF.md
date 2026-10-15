# Phase 2 handoff — Mock2Pitch frontend

## A. Phase
**Phase 2 (complete frontend/UI) is built and verified against a typed in-browser mock data layer.** Nothing talks to hosted Supabase or R2 (no reads, writes or auth). Every screen and state of the design (S1–S18, A0–A6) exists on desktop and mobile, plus the §1.3 additions. Phase 3 replaces the mock adapter with a Supabase/R2 adapter behind the same `DataPort` (§N).
What was **not** possible in this sandbox (details in §F): WebKit/Safari run, real-device recording check.

## B. Completed
* **Design handoff** copied unchanged to `docs/design-handoff/`; reference screenshots of the prototype (37 states × desktop and mobile) in `docs/phase-2/reference/`; repo inspection in `existing-state.md`.
* **Foundation**: tokens (`styles/tokens.css`, values unchanged), self-hosted fonts (Autour One, LXGW WenKai TC; Latin subsets, ≈28 KB each, OFL), 16 design-system components (`components/ds`), app components (`components/app`), `/dev/design-system` (a `*.dev.tsx` page, absent from production).
* **Routes/screens** (all in `frontend.md`): landing, sign-in, terms/privacy, onboarding terms + profile, dashboard, upload, reading, prepare, time, mic check, practice room, review, analysing, report (+rating), history, deck detail, settings (+Delete account), limit, blocked (`/paused`), admin sign-in, overview, students, student detail, ratings, AI usage (3×3), terms editor (publish).
* **Responsive**: one breakpoint at container width < 760 px; touch targets ≥ 44 px on mobile; no horizontal scroll at 320/390/760/1024/1440.
* **Data layer**: `DataPort` (`lib/data/types.ts`) + TanStack Query hooks; mock adapter with 7 personas, every error code of the contract, exact Realtime stage strings, IST daily limit, failure injection; Supabase adapter folder is a README stub only.
* **Browser capabilities**: pdf.js (legacy build) page rendering with the server's JPEG `rules`; MediaRecorder + level meter + timers + playback + 10-minute cap; 16 kHz mono 16-bit WAV encoder; XHR PUT without `Content-Length`; Realtime watcher with polling fallback; feature detection and "Use Chrome" note.
* **Security**: CSP + security headers (`next.config.mjs`), production build refuses mock mode unless explicitly allowed, dev panel/routes removed from production, bundle scan.
* **Docs**: `frontend.md`, `fidelity.md`, `existing-state.md`, this file, README additions.

## C. Verified (by area) — all executed
| Area | How | Result |
|---|---|---|
| Types/lint | `npx tsc --noEmit`, `npx eslint .` | clean |
| Unit/component | Vitest + RTL + jsdom, `npm run test:frontend` | 108 tests pass (below) |
| Phase 1 suites | `npm test` (unit/db/functions/r2 + frontend) against a local PostgreSQL 16 | 31 files, 350 passed, 4 skipped by design (live AI) |
| E2E desktop | Playwright, Chromium 1280×800 (`desktop-chrome`) | 23 passed, 1 skipped (mobile-only check) |
| E2E mobile | Playwright, Chromium 390×844, touch (`mobile`) | 23 passed |
| Accessibility | axe-core (WCAG 2.0/2.1/2.2 A+AA tags, serious/critical = fail) on every screen/state at 1280 and 390 + horizontal-scroll check at 320/390/760/1024/1440 | 3/3 pass |
| Production build | `npm run build:review` (webpack) | OK; 32 routes, `/dev/*` absent |
| Production-only checks | `node scripts/check-prod-bundle.mjs`, `npm run scan:bundle` | clean (no mock panel/`__m2pMock`/dev routes; no secret names or values in `.next/static`) |
| Production smoke | journeys 1–2 against `next start` (CSP + HSTS active), desktop and mobile | 4/4 pass |
| Lighthouse | `node scripts/lighthouse.mjs` against `next start` (median of 3 for mobile) | see §D |
| Fidelity | side-by-side of 37 screens × 2 sizes | `fidelity.md` |

## D. Test results
### Unit / component (`npm run test:frontend`, 108 tests, 8 files)
| File | Tests | Scope |
|---|---|---|
| `format-score.test.ts` | 9 | m:ss, en-IN dates, IST midnight/countdown, score bands and colours, filler splitting |
| `audio-upload.test.ts` | 16 | JPEG rule stepping, WAV encoder validated by the Phase 1 `parseWav` (rate/mono/16-bit/size), upload helper without Content-Length, progress/abort |
| `ds-components.test.tsx` | 26 | Button/IconButton/Badge/Card/ProgressBar/ScoreRing/Input/Select/Checkbox/Dialog (focus trap, Esc, focus return)/Toast/Tooltip/Tabs/LevelMeter/RecordButton states, ARIA |
| `guards-errors.test.ts` | 17 | `decideStudent`/`decideAdmin` for every persona and path (policy-exempt `/session/*`), `safe-next`, error-code → UI map covers **every** code |
| `hooks-gate.test.tsx` | 10 | query hooks + StudentGate/AdminGate rendering (no protected content before decisions), invalidation |
| `mock-adapter.test.ts` | 24 | every operation/error code, daily limit, policy republish, pinning, rating once, deletion, Realtime stages, PUT validation |
| `mock-flow.test.ts` | 2 | full upload → analysis → report through the port with real scoring |
| `watch.test.ts` | 4 | Realtime watcher: hydrate, subscribe, polling fallback after 10 s quiet |

### E2E (Playwright, commands: `npm run test:e2e`, `test:e2e:mobile`, `test:a11y`, `test:webkit`)
Journeys 1–10 of §10 plus 11 (keyboard-only room) — run on **desktop** (23 tests incl. sub-cases) and **mobile** (23; journey 11 is desktop-only). Every test fails on any console error/warning (the only allow-listed messages are Next's route-prefetch preload notice and the Next *dev* server's "Fast Refresh full reload" notice, neither of which can occur in a production build). Coverage: onboarding; full practice flow (mic denied → granted, record, overrun red, playback, re-record, End dialog, review, submit, analysing stages, report with 4 sub-scores + Pacing info, accordion, transcript highlights, rating); retake with delta, pin/unpin, deck detail; upload errors (non-PDF, 5 MB+1, 11 pages, encrypted/corrupt, upload failure + retry, session consumption); daily limit; policy republish in the room; AI busy on reading/analysis, `audio_invalid`; blocked student; settings incl. delete account; admin incl. block/unblock, ratings filters, AI usage 3×3, terms publish, role redirects; guards and open-redirect protection; touch targets ≥ 44 px (`touch-targets.spec.ts`, mobile).
* **a11y sweep** (`e2e/a11y-sweep.spec.ts`, project `a11y`): axe on every screen/state at 1280 and 390 px plus no horizontal scroll at 320/390/760/1024/1440 px.
* **WebKit smoke** (`e2e/webkit-smoke.spec.ts`, project `webkit-smoke`): written but **not executed** — the sandbox has no WebKit and installing browsers is not permitted. Run `npx playwright install webkit` then `npm run test:webkit` on a machine with network access.
* **Production smoke**: `E2E_PROD=1 E2E_PORT=3200 npx playwright test e2e/journey-1-onboarding.spec.ts e2e/journey-2-practice.spec.ts` against `npx next start -p 3200` (journey 2's last assertion needs the dev-only inspection hook and is skipped in that mode).

### Lighthouse (`docs/phase-2/lighthouse.json`; production build in mock mode, simulated slow-4G, 4× CPU)
| Page | Mobile perf (median of 3; runs) | LCP | TBT | CLS | A11y / BP / SEO |
|---|---|---|---|---|---|
| Landing | 90 (91, 88, 90) | 3.3 s | 172 ms | 0 | 100 / 100 / 100 |
| Dashboard | 85 (85, 85, 85) | 3.6 s | 267 ms | 0.017 | 100 / 100 / 100 |
| Report | **82** (81, 82, 85) | 3.7 s | 335 ms | 0 | 100 / 100 / 100 |
Target in the spec: ≥ 85 on mobile. **Landing and Dashboard meet it; Report does not reliably (82 median, 76–86 observed over repeated runs, depending on machine load).** The time is dominated by hydration of Next's client runtime (~0.9 s of scripting under 4× throttle) and by the gate → page query waterfall (session → profile/policy → report) with the mock's simulated 120 ms per call; the page's own chunk is 11 KB and the mock adapter 59 KB. Desktop (single run): Landing 78, Dashboard 63, Report 65. Possible Phase 3 improvement: prefetch the report while the gate resolves. Scores are noisy by ±3–5 points; running with another dev server active lowered them further.

## E. Security review (§9)
| Requirement | Status |
|---|---|
| No secrets in the client; only `NEXT_PUBLIC_*` public | ✅ `lib/env.public.ts` (browser-safe, no server names) split from `lib/env.ts` (server); scanner initially caught the server variable *names* in a client chunk, fixed; `npm run scan:bundle` clean |
| No user/AI text rendered as HTML | ✅ no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere (grep); `Doc` renderer builds elements; filler highlighting uses React nodes |
| Presigned URLs not logged/stored/put in the URL bar | ✅ only held in memory; no `console.log` in app code; mock `mock://` URLs only |
| Recordings in memory only; object URLs revoked on leave | ✅ no IndexedDB/localStorage; `MicReleaser` + store revoke on leaving `/session/*` |
| `localStorage` only for harmless prefs, try/catch | ✅ only the "My notes" panel state |
| Security headers | ✅ `Content-Security-Policy` (default-src self; connect-src self + Supabase https/wss + `*.r2.cloudflarestorage.com`; img/media + `blob:`, Google avatars; `worker-src self blob:`; `'wasm-unsafe-eval'`; `frame-ancestors 'none'`; `object-src 'none'`), `Permissions-Policy: microphone=(self), camera=()…`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS (production). Verified: journeys pass under the dev CSP and journeys 1–2 under the production CSP with zero console warnings |
| CSP limitation | `script-src`/`style-src` keep `'unsafe-inline'` (Next inline bootstrap + React style attributes; no nonce pipeline). Dev adds `'unsafe-eval'`. Tightening with nonces is a possible Phase 3 hardening |
| Dev-only routes/panel absent in production | ✅ `/dev/design-system` is a `*.dev.tsx` page excluded via `pageExtensions`; mock panel and `window.__m2pMock` compiled out; `check-prod-bundle.mjs`; a production build with mock mode fails unless `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1` |
| Open redirects | ✅ `?next=` accepts same-origin app paths only (`lib/safe-next.ts`, journey 10b) |
| Avatars | ✅ `referrerPolicy="no-referrer"`, initials fallback on error |
| Delete account | ✅ typed `DELETE` confirmation, button disabled until typed |
Not applicable until Phase 3: real auth cookies, real signed URLs, JWT handling.

## F. Issues / open questions (owner confirmation needed)
**§1.3 additions (built in the design system's language, please confirm copy and behaviour):** Delete account (danger card + typed `DELETE` dialog, toast "Your account was deleted"); blocked screen "Your account is paused"; AI failure cards on S7/S13 (`ai_unavailable`, `audio_invalid` → back to Review for that slide, `report_invalid`/generic); PowerPoint hint and "Use Chrome" note; 10:00 hard recording cap with toast.
**§1.5 defaults:** Admin AI usage = 3 cards (Slide reading, Speech to text, Report analysis) × 3 key slots with Configured / Not configured / Cooling down / Running low (> 75 %) and a 7-day bar chart per card; deck-detail "Sub-scores by attempt" compares first vs latest; retake delta pill "+12 from your first attempt (62)".
**Fidelity deviations:** all listed in `fidelity.md` (PDF-only copy, 4 scored sub-scores + Pacing info, real slide images, AI usage 3×3, contrast-refined colours incl. the red button face `#C93A3A`, mobile select chevrons/stacked dialog buttons). Judged immaterial and left: slightly different wrapping of the mobile landing headline and a few titles.
**Testing gaps (not done, not hidden):**
1. **WebKit/Safari**: project `webkit-smoke` exists but could not run (no WebKit in the sandbox, `playwright install` not allowed).
2. **Real-device recording check** (Chrome desktop, Safari iOS, Chrome Android): **not performed.** What *was* verified: in Chromium with a fake microphone (a synthetic 16 kHz speech-like WAV) the real MediaRecorder → decode → OfflineAudioContext → WAV pipeline ran in journeys 2/6, and the clips were accepted by the Phase 1 `parseWav` checker inside the mock backend (16 kHz, mono, 16-bit, declared size equals body size). Safari iOS (`audio/mp4` AAC decoding, `OfflineAudioContext` quirks) and Android Chrome remain unverified; a human recording on those devices is required before launch.
3. **Lighthouse Report page** below the 85 target (82 median), see §D.
4. Performance and visuals were measured in headless Chromium only.
**Behaviours the mock cannot prove** (Phase 3 must confirm against the real backend): see §N "assumptions".

## G. Files / architecture
See `docs/phase-2/frontend.md` (routes table, guards, DS components, responsive model, data port, mock adapter, capability modules). Key locations: `app/` (routes), `components/ds|app|dev`, `features/<area>` (screens + `queries.ts`), `lib/data` (port, errors, mock adapter, supabase stub), `features/{upload,recording,realtime}` (browser capabilities), `e2e/`, `tests/frontend/`, `scripts/` (`ref-screenshots`, `capture-screens`, `lighthouse`, `check-prod-bundle`, fixtures generators).
Phase 1 files touched (frontend-only, no backend change): `lib/env.ts` split into `lib/env.public.ts` (+ server part), `lib/supabase/browser.ts` import path, `next.config.mjs`, `package.json`, `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `app/layout.tsx`, `types/css.d.ts`. **No file under `supabase/`, `infra/`, `types/database.ts`, `.github/` or Phase 1 tests was changed.**

## H. Environment (names only)
`NEXT_PUBLIC_DATA_MODE` (`mock` default in Phase 2 | `supabase` in Phase 3), `NEXT_PUBLIC_ALLOW_MOCK_IN_PROD` (`1` only for a review deploy), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (used by Phase 3; the CSP reads `NEXT_PUBLIC_SUPABASE_URL` at build time). Server-only names unchanged from Phase 1 (`.env.example`). E2E: `E2E_PORT`, `E2E_PROD`; Lighthouse: `BASE_URL`, `LH_RUNS`.

## I. Test personas (mock) and Phase 1 accounts
Mock (`?persona=<id>` on any URL, or the dev panel): `signed_out`, `new_student` (needs Terms + profile; Google sign-in from `signed_out` becomes this), `student` (no history), `returning_student` (ParkSense, reports 62 → 74, 2 of 5 sessions used), `at_limit` (5 of 5), `blocked`, `admin` (owner; 10 students, 8 ratings, AI usage 3×3, 3 policy versions). Phase 1 local accounts (`supabase/seed.sql`, email/password, local only) are unchanged — see `PHASE-1-HANDOFF.md` §I.

## J. Backend summary and gaps
Unchanged from Phase 1 (see `PHASE-1-HANDOFF.md`). **Backend gaps found while building the UI** (no backend change was made; each is handled by a documented workaround):
1. **Dashboard "Key points" tile**: `my_dashboard_stats` returns `total_key_points_covered` (all attempts) but nothing per last attempt; the tile shows the total ("covered in total") and the "Best score" caption is "best of N attempts".
2. **Dashboard deck meta** has no target minutes (`my_decks` lacks it), so it shows slides · attempts only.
3. **Admin overview** has no week-over-week/"yesterday" deltas; sub-texts are derived ("Signed in with Google", "N in the last 14 days"). "AI credits used … of N" is derived by summing `admin_ai_usage` limits.
4. **No endpoint to abandon an unsubmitted session**: "Leave session" only discards recordings locally; the server session stays `in_progress` (and the daily session is already consumed at `start_practice_session`/upload completion). Please confirm that leftover `in_progress` sessions are harmless/swept.
5. **First-time vs "Terms updated"**: the UI reads `policy_acceptances` (non-empty ⇒ updated) because no RPC says whether the user ever accepted anything.
6. **Realtime payloads** are assumed to carry the row columns listed in `DeckEvent`/`SessionEvent`; `report_id` is read from `reports` after `completed`.
7. **Student list** shows `total_count` from the RPC truthfully ("10 of 412 shown").
8. The UI never needs service-role access; admins get 403 `is_admin` from `asset-urls` (the admin UI therefore shows no slide images).

## K. R2 summary (client behaviour implemented)
* Upload: `PUT` to the presigned URL via XHR with `Content-Type` exactly as signed and **no `Content-Length`** (the browser sets it; body size equals the declared size). Progress and abort supported (`lib/upload/put.ts`). PDF is uploaded as `application/pdf`; slide JPEGs as `image/jpeg`; clips as `audio/wav`.
* Slide JPEGs: pdf.js page → canvas → JPEG using the `rules` from `deck-upload-complete` (1280 px, quality 0.8 → 0.5, then width → 800, ≤ 1,000,000 bytes; verified by unit tests).
* Audio: 16 kHz mono 16-bit PCM WAV, ≤ 20 MB per clip (10:00 hard cap), all clips uploaded together with per-clip progress; failed clips retried individually.
* Download: slide images come from `asset-urls` (10-minute URLs); `SlideView` refetches once when an image fails to load.
* The deployed origin must be added to the bucket CORS (`infra/r2-cors.json`) — Phase 3 carry-forward.

## L. §14 Definition of Done
- [x] Design handoff in `docs/design-handoff/`; reference screenshots at both sizes.
- [x] Tokens, self-hosted fonts and all DS components; `/dev/design-system` shows every state (absent in production, verified).
- [x] Every route of §3.5 exists; every screen/state of §4 on desktop and mobile incl. §1.3 additions; prototype-only tools removed.
- [x] Guards behave per persona with no protected-content flash (unit + journeys 7, 9, 10).
- [x] Data port covers every backend operation with contract-accurate types; mock simulates all states and error codes; Supabase adapter folder stubbed only.
- [x] pdf.js, MediaRecorder, level meter, timers, playback, WAV conversion, presigned-PUT helper implemented and unit-tested.
- [x] Report: 4 scored sub-scores + Pacing info card; overall/colour rules (unit-tested).
- [x] Admin AI usage 3 cards × 3 keys; listed for owner confirmation (§F).
- [x] axe zero serious/critical on every screen/state (desktop + mobile); keyboard-only room works (journey 11); reduced motion honoured.
- [x] No horizontal scroll at 320–1440 px; touch targets ≥ 44 px on mobile (enforced by test).
- [◐] Unit/component and E2E suites executed and re-run until green on desktop and mobile; **WebKit smoke written but not executed** (no WebKit in the sandbox).
- [x] Fidelity review completed (`fidelity.md`); the differences found were fixed or listed.
- [x] `tsc`, ESLint, production `next build` clean; bundle scan clean; mock panel/dev routes absent; CSP active and app working (production smoke).
- [◐] Lighthouse recorded; **Report mobile performance 82 < 85 target**; no console errors in E2E.
- [x] No backend files changed; no secrets committed.
- [x] Documentation (§12) complete.
- [ ] Manual check on real devices (Chrome desktop, Safari iOS, Chrome Android) — **not possible in the sandbox**.

## M. Next phase
Phase 3: implement `lib/data/supabase` (all of §N), switch `NEXT_PUBLIC_DATA_MODE=supabase`, configure Google OAuth, deploy to Netlify, add the origin to R2 CORS, run the carry-forward checks, record a human clip on real devices.

## N. Phase 3 handoff
### N.1 Port method → backend contract (the Supabase adapter must implement exactly `DataPort` in `lib/data/types.ts`)
Edge Functions are `POST /functions/v1/<name>` with the user's JWT; RPCs via `supabase.rpc`; direct reads via supabase-js (RLS applies). Failures must be thrown as `AppError(code, message, details)` using `error.code` (functions) or the RPC exception message.

| Port method | Backend call | Notes |
|---|---|---|
| `auth.getSession()` | `supabase.auth.getSession()` + `select role, full_name, avatar_url from profiles where id = auth.uid()` | `role` decides the student/admin UI |
| `auth.onChange(cb)` | `onAuthStateChange` | UI clears the query cache on every change |
| `auth.signInWithGoogle({next, hint})` | `signInWithOAuth({ provider: 'google', options: { redirectTo: `${APP_URL}/auth/callback?next=…` } })` | `hint:'owner'` only changes the page copy; owner promotion is the backend's `sync_owner_role` |
| `auth.signOut()` | `auth.signOut()` | |
| `profile.getMine()` | `select * from profiles where id = auth.uid()` | |
| `profile.update({college,year,branch,full_name?})` | `update profiles set college, year, branch` (allowed columns only) | `profile_completed_at` must become non-null once all three are set (confirm the trigger) |
| `policy.getLatest()` | `select * from policy_versions order by published_at desc limit 1` | anon-readable (Terms/Privacy pages are public) |
| `policy.hasAcceptedLatest()` | `rpc has_accepted_latest_policy` | admins are never gated |
| `policy.listAccepted()` | `select policy_version_id from policy_acceptances` | non-empty ⇒ "updated" Terms variant |
| `policy.accept(versionId)` | `rpc accept_policy({p_version_id})` | `not_latest_policy` |
| `dashboard.getStats()` | `rpc my_dashboard_stats` (one row) | `next_reset_at` drives the S18 countdown |
| `dashboard.listRecentReports(n)` | `select id, deck_id, overall_score, attempt_number, created_at, decks(title) from reports order by created_at desc limit n` | feeds the "Your progress" chart |
| `decks.list()` | `rpc my_decks` | pinned first |
| `decks.get(id)` | `select * from decks`, `select * from slides order by slide_index`, latest `practice_sessions` (`total_minutes`, `suggested_seconds`) | |
| `decks.attempts(id)` | `rpc my_deck_detail({p_deck_id})` | |
| `decks.setPinned(id, pinned)` | `rpc set_deck_pinned` | blocked students get `blocked` |
| `decks.getAssetUrls(id, kinds)` | function `asset-urls` | 10-minute GET URLs; `SlideView` refetches once on an image error |
| `decks.getStatus(id)` | `select id, status, processing_stage, processed_slides, error_code, page_count from decks` | hydrates before realtime |
| `upload.init` / `complete` / `process` | functions `deck-upload-init` / `deck-upload-complete` / `deck-process` | PUT goes through `lib/upload/put.ts` (XHR, no Content-Length) |
| `sessions.start(deckId, minutes)` | `rpc start_practice_session` | a retake consumes one daily session |
| `sessions.get(id)` | `select id, deck_id, attempt_number, total_minutes, suggested_seconds, status, analysis_stage, error_code from practice_sessions` + `select id from reports where session_id = …` when completed | |
| `sessions.getOpenForDeck(deckId)` | `select … from practice_sessions where deck_id = … and status in (…)` | |
| `sessions.submitInit` / `analyse` | functions `session-submit-init` / `session-analyse` | clips are validated server-side (`audio_invalid` + `slide_index` + `reason`) |
| `reports.get(id)` | `select * from reports`, `session_slide_results`, `slides`, `decks.title`, `practice_sessions.suggested_seconds`, `report_ratings` | JSON columns `fillers`, `word_timings` are parsed |
| `reports.getBySession(id)` | `select id from reports where session_id = …` | |
| `reports.rate(id, stars, comment)` | `rpc rate_report` | |
| `realtime.subscribeDeck(id)` / `subscribeSession(id)` | `channel().on('postgres_changes', { table: 'decks'|'practice_sessions', filter: 'id=eq.<id>' })` | the callback payload is the row subset in `DeckEvent` / `SessionEvent`; `report_id` is looked up on `completed` |
| `account.delete('DELETE')` | function `account-delete` | then sign out |
| `admin.overview()` | `rpc admin_overview` | |
| `admin.sessionsPerDay(14)` | `rpc admin_sessions_per_day({p_days})` | |
| `admin.listStudents({search,limit,offset})` | `rpc admin_list_students` | `total_count` on each row |
| `admin.studentDetail(id)` | `rpc admin_student_detail` | |
| `admin.setBlocked(id, blocked)` | `rpc admin_set_blocked` | |
| `admin.ratings(stars?)` | `rpc admin_ratings({p_stars})` | |
| `admin.aiUsage(7)` / `aiKeys()` | `rpc admin_ai_usage({p_days})` / function `admin-ai-keys` | joined by `slot_id` in the UI |
| `admin.policyVersions()` / `publishPolicy(...)` | `rpc admin_policy_versions` / `rpc admin_publish_policy` | `invalid_label`, `invalid_body`, `label_not_increasing` |

## Screens that rely on Realtime
S7 Reading slides (`decks`), S13 Analysing (`practice_sessions`). Both also poll every 3 s when no event arrived for 10 s (`features/realtime/watch.ts`).

## Where the Google OAuth redirect lands
`/auth/callback` (placeholder route handler in Phase 2): exchange the code for a session, then redirect to the sanitised `next` (`lib/safe-next.ts`). The student guards then handle Terms/profile; the owner lands on `/admin`.

### N.2 Realtime
S7 (Reading slides, `decks`) and S13 (Analysing, `practice_sessions`) subscribe through `realtime.subscribeDeck/subscribeSession`; both hydrate from a read first and poll every 3 s after 10 s without an event.
### N.3 Google OAuth redirect
Phase 2 ships a placeholder `app/auth/callback/route.ts`. Phase 3: `signInWithOAuth({ provider: 'google', options: { redirectTo: `${APP_URL}/auth/callback?next=…` } })`; the callback exchanges the code, then redirects to the sanitised `next` (`lib/safe-next.ts`); the guards route Terms/profile; the owner lands on `/admin` (owner promotion by `sync_owner_role` on first login — verify, see `owner-setup.md`).
### N.4 Carry-forward items (§13), status
| Item | Status |
|---|---|
| Configure Google provider, verify owner promotion on first login | ⛔ Phase 3 |
| Add the Netlify origin to R2 CORS (`infra/r2-cors.json`) | ⛔ Phase 3 |
| Confirm secret `NVIDIA_SLIDE_MODEL=meta/llama-3.2-11b-vision-instruct` | ⛔ Phase 3 (no hosted access in Phase 2) |
| Add fallback NVIDIA keys when available | ⛔ owner |
| Record a **human** clip and check filler retention | ⛔ needs real device/microphone |
| Observe Realtime in a browser | ⛔ Phase 3 (mock only here) |
| `verify_jwt` vs asymmetric JWT keys | ⛔ Phase 3 |
| Owner review of legal text v1.0 → publish v1.1 (the admin Terms editor exists) | ⛔ owner |
| Scoring constants review | ⛔ owner |
| R2 lifecycle safety-net key layout question | ⛔ Phase 3/owner |
### N.5 Assumptions the UI made that Phase 3 must confirm against the real backend
1. `my_dashboard_stats().next_reset_at` is the next IST midnight (drives the S18 countdown); the UI also computes it locally for the sidebar.
2. `has_accepted_latest_policy` is cheap enough to call on every navigation outside `/session/*` (the UI re-checks so a mid-session republish shows "Terms updated" on the next navigation).
3. `profile_completed_at` becomes non-null once college, year and branch are saved; `update profiles` accepts `full_name, college, year, branch` only.
4. Blocked students can still read decks/reports/history/settings; writes return `blocked`.
5. `deck-process` may return `202` (processing) or `200` (`ready`); the UI watches the deck row and retries by calling it again after `ai_unavailable`.
6. `session-analyse` may be called again after `failed` (up to 3 attempts); the UI sends the user back to Review for `audio_invalid` (+ `slide_index`).
7. `asset-urls` returns every slide image URL in one call; GET URLs expire in 10 minutes and the UI refetches once on an image error.
8. A started session that the user abandons stays `in_progress` (gap 4 above); starting a new session for the same deck while one is open must not fail.
9. `report` JSON columns (`fillers`, `word_timings`, `top_fixes`, `did_well`) have the shapes in `types/database.ts`; indexes in `key_points_*` refer to `slides.key_points`.
10. The admin list RPCs return `total_count` on every row and sort as the UI assumes (most recently active first).
