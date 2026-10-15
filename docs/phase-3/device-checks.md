# Device and browser checks (Phase 3)

## Done in this sandbox
| Check | Result |
|---|---|
| Desktop Chromium 1280×800, real stack: all journeys (`integration.md`) | pass |
| Mobile Chromium emulation (Pixel 7 profile, 390×844, touch), real stack: smoke, admin (card list), limit + deep links, **full practice flow** (upload with an expired-URL retry → record → aborted clip → retry → report) | pass |
| Mock-mode Playwright desktop / mobile / axe | pass (23 / 23 / sweep) |
| Microphone | Chromium fake device fed with a WAV (`--use-file-for-fake-audio-capture`): MediaRecorder → 16 kHz mono WAV → R2 → ASR works end to end |

## Not possible here — owner/real-device checklist (≈15 min)
The sandbox has no WebKit browser with a real microphone, no phone, and no Google account. Please run on the deployed site once Netlify is up:

1. **Android Chrome** (real phone): sign in with Google → upload a 3-slide PDF → record 20 s on slide 1 → submit → report. Check the mic permission prompt, that the level meter moves, that playback in the review screen works, and that the page does not scroll sideways.
2. **iPhone Safari** (iOS 16+): same flow. Watch for: recording starts only after a tap (expected), `audio/mp4` recording accepted by the WAV conversion, screen lock during a recording (Safari may stop the mic — we show the message from Phase 2).
3. **Desktop Safari**: sign in and upload (pdf.js), record 10 s.
4. **Desktop Firefox**: sign in, upload, record 10 s.
5. **Google sign-in** with the owner account (lands on `/admin`) and a second student account (lands on Terms → profile → dashboard); sign out; sign in again (no second Terms screen).
6. **Human filler clip** (`fillers.md`): say "um … so, uh, basically, you know, like" and compare the report.
7. Optional: Lighthouse on the deployed URL (`node scripts/lighthouse.mjs <url>`; Phase 2 numbers are in `docs/phase-2/lighthouse.json`).

Report anything odd with the browser, OS version and the time; the Edge Function logs are keyed by time.

## WebKit in CI (mock mode)
`webkit-smoke` (Playwright WebKit 26 on Ubuntu) now gets through sign-in → Terms → profile → dashboard, i.e. the first real WebKit evidence for those screens. A full page reload of `/practice/new` right after onboarding was bounced back to `/dashboard` in WebKit only; the smoke test therefore navigates inside the app (clicks "Upload slides"). This concerns the **mock** backend's sessionStorage persistence; in supabase mode the session is a cookie and a reload does not depend on it. Not re-verified against the real backend in WebKit — part of the Safari checklist above.
