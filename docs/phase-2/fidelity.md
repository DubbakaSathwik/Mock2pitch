# Phase 2 — visual fidelity review

**Method.** Every screen/state was captured from the new app at 1280×800 (desktop) and 390×844 (mobile) by `scripts/capture-screens.mjs` (mock mode, same persona/state set as the prototype capture) into `docs/phase-2/screens/{desktop,mobile}/`, using the **same file names** as the prototype captures in `docs/phase-2/reference/{desktop,mobile}/` (taken from `docs/design-handoff/.../prototype`). Each pair was compared side by side (left = prototype, right = new; composites were built with Pillow at 50–60 % scale). Review was done twice: by me for 15 pairs (desktop 01, 05, 07, 11, 16, 20, 23, 27, 28, 29, 32, 35 and mobile 16, 23, 31) and by an independent reviewer (a separate agent with no knowledge of my conclusions) for the other 59 composites. Neither review used pixel diffing: it is a visual comparison at reduced scale, so differences of one or two pixels, or sub-pixel font rendering, are not claimed to be absent. Visual snapshot assertions were not added (optional in the spec).

Extra captures with no prototype counterpart (new states required by §1.3): `extra-blocked-paused.png`, `extra-a6-publish-dialog.png` (desktop and mobile).

## Pairs

| Screen | Desktop | Mobile | Intentional differences / notes |
|---|---|---|---|
| 01-s1-landing | [ref](reference/desktop/01-s1-landing.png) · [new](screens/desktop/01-s1-landing.png) | [ref](reference/mobile/01-s1-landing.png) · [new](screens/mobile/01-s1-landing.png) | Report card shows the 4 scored sub-scores + Pacing as an info row (§1.2); filler bar uses the warning band colour. Mobile headline uses `text-wrap: balance`. |
| 02-s2-sign-in | [ref](reference/desktop/02-s2-sign-in.png) · [new](screens/desktop/02-s2-sign-in.png) | [ref](reference/mobile/02-s2-sign-in.png) · [new](screens/mobile/02-s2-sign-in.png) | – |
| 03-s3-terms-first-time | [ref](reference/desktop/03-s3-terms-first-time.png) · [new](screens/desktop/03-s3-terms-first-time.png) | [ref](reference/mobile/03-s3-terms-first-time.png) · [new](screens/mobile/03-s3-terms-first-time.png) | Terms/Privacy text comes from the Phase 1 policy versions (mock copy of v1.0-style text); PDF-only wording. |
| 04-s3-terms-updated | [ref](reference/desktop/04-s3-terms-updated.png) · [new](screens/desktop/04-s3-terms-updated.png) | [ref](reference/mobile/04-s3-terms-updated.png) · [new](screens/mobile/04-s3-terms-updated.png) | Version label and text come from the mock policy; otherwise identical. |
| 05-s4-profile-setup | [ref](reference/desktop/05-s4-profile-setup.png) · [new](screens/desktop/05-s4-profile-setup.png) | [ref](reference/mobile/05-s4-profile-setup.png) · [new](screens/mobile/05-s4-profile-setup.png) | Select chevrons added on mobile (reference inputs overflowed the card). |
| 06-s5-dashboard-empty | [ref](reference/desktop/06-s5-dashboard-empty.png) · [new](screens/desktop/06-s5-dashboard-empty.png) | [ref](reference/mobile/06-s5-dashboard-empty.png) · [new](screens/mobile/06-s5-dashboard-empty.png) | – |
| 07-s5-dashboard-with-history | [ref](reference/desktop/07-s5-dashboard-with-history.png) · [new](screens/desktop/07-s5-dashboard-with-history.png) | [ref](reference/mobile/07-s5-dashboard-with-history.png) · [new](screens/mobile/07-s5-dashboard-with-history.png) | Deck meta omits the target minutes; Key points tile shows total covered; Best score caption is “best of N attempts” (contract has no per-attempt totals). Chart is wider (y-range 40–100 unchanged). |
| 08-s6-upload | [ref](reference/desktop/08-s6-upload.png) · [new](screens/desktop/08-s6-upload.png) | [ref](reference/mobile/08-s6-upload.png) · [new](screens/mobile/08-s6-upload.png) | PDF only: PowerPoint hint “Choose File → Save as PDF” replaces the .pptx wording (§1.2/§1.3); prototype shortcuts removed. |
| 09-s6-upload-error | [ref](reference/desktop/09-s6-upload-error.png) · [new](screens/desktop/09-s6-upload-error.png) | [ref](reference/mobile/09-s6-upload-error.png) · [new](screens/mobile/09-s6-upload-error.png) | Real error copy per code (`not_pdf`, `too_large`, `too_many_pages`, …). |
| 10-s7-extracting | [ref](reference/desktop/10-s7-extracting.png) · [new](screens/desktop/10-s7-extracting.png) | [ref](reference/mobile/10-s7-extracting.png) · [new](screens/mobile/10-s7-extracting.png) | Stage text and counts come from the Realtime strings; thumbnails are the real rendered slides. |
| 11-s8-slide-prep | [ref](reference/desktop/11-s8-slide-prep.png) · [new](screens/desktop/11-s8-slide-prep.png) | [ref](reference/mobile/11-s8-slide-prep.png) · [new](screens/mobile/11-s8-slide-prep.png) | Real slide images; “About 20 seconds in a 5 minute run” uses the chosen total. |
| 12-s9-set-time | [ref](reference/desktop/12-s9-set-time.png) · [new](screens/desktop/12-s9-set-time.png) | [ref](reference/mobile/12-s9-set-time.png) · [new](screens/mobile/12-s9-set-time.png) | Native number spinner hidden to match the prototype. |
| 13-s10-mic-check | [ref](reference/desktop/13-s10-mic-check.png) · [new](screens/desktop/13-s10-mic-check.png) | [ref](reference/mobile/13-s10-mic-check.png) · [new](screens/mobile/13-s10-mic-check.png) | “Use Chrome for the best results” note on non-Chromium browsers; 10-minute recording cap copy (§1.3). |
| 13b-s10-mic-granted | [ref](reference/desktop/13b-s10-mic-granted.png) · [new](screens/desktop/13b-s10-mic-granted.png) | [ref](reference/mobile/13b-s10-mic-granted.png) · [new](screens/mobile/13b-s10-mic-granted.png) | Live input level. |
| 14-s10-mic-denied | [ref](reference/desktop/14-s10-mic-denied.png) · [new](screens/desktop/14-s10-mic-denied.png) | [ref](reference/mobile/14-s10-mic-denied.png) · [new](screens/mobile/14-s10-mic-denied.png) | Title wraps one word earlier at 390 px. |
| 15-s11-before-recording | [ref](reference/desktop/15-s11-before-recording.png) · [new](screens/desktop/15-s11-before-recording.png) | [ref](reference/mobile/15-s11-before-recording.png) · [new](screens/mobile/15-s11-before-recording.png) | Real slides. |
| 16-s11-recording | [ref](reference/desktop/16-s11-recording.png) · [new](screens/desktop/16-s11-recording.png) | [ref](reference/mobile/16-s11-recording.png) · [new](screens/mobile/16-s11-recording.png) | Live timers (values differ by moment of capture). |
| 17-s11-recorded | [ref](reference/desktop/17-s11-recorded.png) · [new](screens/desktop/17-s11-recorded.png) | [ref](reference/mobile/17-s11-recorded.png) · [new](screens/mobile/17-s11-recorded.png) | Live timers. |
| 18-s11-overrun-red | [ref](reference/desktop/18-s11-overrun-red.png) · [new](screens/desktop/18-s11-overrun-red.png) | [ref](reference/mobile/18-s11-overrun-red.png) · [new](screens/mobile/18-s11-overrun-red.png) | Overrun text may wrap onto its own line on mobile. |
| 19-s11-leave-confirm | [ref](reference/desktop/19-s11-leave-confirm.png) · [new](screens/desktop/19-s11-leave-confirm.png) | [ref](reference/mobile/19-s11-leave-confirm.png) · [new](screens/mobile/19-s11-leave-confirm.png) | Dialog body text added; mobile buttons stack (reference clipped “Keep practising”). |
| 20-s12-review-all-recorded | [ref](reference/desktop/20-s12-review-all-recorded.png) · [new](screens/desktop/20-s12-review-all-recorded.png) | [ref](reference/mobile/20-s12-review-all-recorded.png) · [new](screens/mobile/20-s12-review-all-recorded.png) | Durations are those of the captured test clips. |
| 21-s12-review-some-missing | [ref](reference/desktop/21-s12-review-some-missing.png) · [new](screens/desktop/21-s12-review-some-missing.png) | [ref](reference/mobile/21-s12-review-some-missing.png) · [new](screens/mobile/21-s12-review-some-missing.png) | Banner “N slides are not recorded yet”. |
| 22-s13-analysing | [ref](reference/desktop/22-s13-analysing.png) · [new](screens/desktop/22-s13-analysing.png) | [ref](reference/mobile/22-s13-analysing.png) · [new](screens/mobile/22-s13-analysing.png) | Stage strings from Realtime. |
| 23-s14-report-attempt-1 | [ref](reference/desktop/23-s14-report-attempt-1.png) · [new](screens/desktop/23-s14-report-attempt-1.png) | [ref](reference/mobile/23-s14-report-attempt-1.png) · [new](screens/mobile/23-s14-report-attempt-1.png) | 4 scored sub-scores (Timing, Filler words, Slide coverage, Clarity) + Pacing info-only card (“For your information”, no score/colour) (§1.2). Overall = average of the 4. |
| 24-s14-report-retake-74 | [ref](reference/desktop/24-s14-report-retake-74.png) · [new](screens/desktop/24-s14-report-retake-74.png) | [ref](reference/mobile/24-s14-report-retake-74.png) · [new](screens/mobile/24-s14-report-retake-74.png) | Delta pill and first-attempt comparison; filler score amber vs blue is data, not style. |
| 25-s15-history-empty | [ref](reference/desktop/25-s15-history-empty.png) · [new](screens/desktop/25-s15-history-empty.png) | [ref](reference/mobile/25-s15-history-empty.png) · [new](screens/mobile/25-s15-history-empty.png) | – |
| 26-s15-history | [ref](reference/desktop/26-s15-history.png) · [new](screens/desktop/26-s15-history.png) | [ref](reference/mobile/26-s15-history.png) · [new](screens/mobile/26-s15-history.png) | Mobile: score moves under the title (as in the prototype). |
| 27-s16-deck-detail | [ref](reference/desktop/27-s16-deck-detail.png) · [new](screens/desktop/27-s16-deck-detail.png) | [ref](reference/mobile/27-s16-deck-detail.png) · [new](screens/mobile/27-s16-deck-detail.png) | Sub-scores ordered Timing, Filler words, Slide coverage, Clarity + Pace info row; “First attempt / Latest” legend added. |
| 28-s17-settings | [ref](reference/desktop/28-s17-settings.png) · [new](screens/desktop/28-s17-settings.png) | [ref](reference/mobile/28-s17-settings.png) · [new](screens/mobile/28-s17-settings.png) | Delete account section and dialog (§1.3). |
| 29-s18-limit-reached | [ref](reference/desktop/29-s18-limit-reached.png) · [new](screens/desktop/29-s18-limit-reached.png) | [ref](reference/mobile/29-s18-limit-reached.png) · [new](screens/mobile/29-s18-limit-reached.png) | Countdown computed from the next IST midnight (differs by capture time). |
| 30-a0-owner-sign-in | [ref](reference/desktop/30-a0-owner-sign-in.png) · [new](screens/desktop/30-a0-owner-sign-in.png) | [ref](reference/mobile/30-a0-owner-sign-in.png) · [new](screens/mobile/30-a0-owner-sign-in.png) | – |
| 31-a1-dashboard | [ref](reference/desktop/31-a1-dashboard.png) · [new](screens/desktop/31-a1-dashboard.png) | [ref](reference/mobile/31-a1-dashboard.png) · [new](screens/mobile/31-a1-dashboard.png) | Stats derived from the admin RPCs (no week-over-week deltas in the contract: sub-text is “Signed in with Google”, “N in the last 14 days”, …). Credits “of N” derived from `admin_ai_usage` limits. |
| 32-a2-students | [ref](reference/desktop/32-a2-students.png) · [new](screens/desktop/32-a2-students.png) | [ref](reference/mobile/32-a2-students.png) · [new](screens/mobile/32-a2-students.png) | Shows `total_count` truthfully (“10 of 10” on the 10-student seed). |
| 33-a3-student-detail | [ref](reference/desktop/33-a3-student-detail.png) · [new](screens/desktop/33-a3-student-detail.png) | [ref](reference/mobile/33-a3-student-detail.png) · [new](screens/mobile/33-a3-student-detail.png) | Ratings dates include the year. |
| 34-a4-ratings | [ref](reference/desktop/34-a4-ratings.png) · [new](screens/desktop/34-a4-ratings.png) | [ref](reference/mobile/34-a4-ratings.png) · [new](screens/mobile/34-a4-ratings.png) | Average shown with one decimal (4.0). |
| 35-a5-ai-usage | [ref](reference/desktop/35-a5-ai-usage.png) · [new](screens/desktop/35-a5-ai-usage.png) | [ref](reference/mobile/35-a5-ai-usage.png) · [new](screens/mobile/35-a5-ai-usage.png) | 3 purpose cards × 3 key slots (primary / fallback 1 / fallback 2) instead of 4 cards (§1.5); Running low / Cooling down / Not configured states. |
| 36-a6-terms-and-privacy | [ref](reference/desktop/36-a6-terms-and-privacy.png) · [new](screens/desktop/36-a6-terms-and-privacy.png) | [ref](reference/mobile/36-a6-terms-and-privacy.png) · [new](screens/mobile/36-a6-terms-and-privacy.png) | Publish disabled until edited; label validation. |

## Intentional differences (summary)
1. **PDF only** (§1.2): no .pptx; PowerPoint hint “Choose File → Save as PDF” (§1.3); prototype-only shortcut buttons (“Prototype shortcuts”, “Demo: block it”, the floating “Screens” pill) removed.
2. **Four scored sub-scores** (Timing, Filler words, Slide coverage, Clarity) with **Pacing info-only** (“For your information”, no score, no colour) on the report, history, deck detail and landing sample (§1.2).
3. **Real slide images** rendered from the uploaded PDF instead of prototype art; live timers/levels; real durations from the clips.
4. **Admin AI usage = 3 purposes × 3 key slots** (§1.5) instead of four generic cards.
5. §1.3 additions: Delete account (+dialog), Blocked screen (`/paused`), AI failure states, “Use Chrome” note, 10-minute recording cap.
6. Contrast refinements (`styles/globals.css`): muted text `#5A6080`, success/danger text on tinted badges, warning score numbers; the red “record/danger” button face is `#C93A3A` instead of `#D64545` (white text measured 4.2:1, now 5.1:1). Tokens in `styles/tokens.css` are unchanged.
7. Data-dependent text that the contracts cannot supply exactly (see the Backend gaps in the handoff): dashboard deck meta without target minutes, “best of N attempts”, admin stat sub-text.
8. Mobile touches: select chevrons, stacked buttons in the leave dialog, hidden number spinner, `text-wrap: balance` on the landing headline; the reference had clipped/overflowing controls in these places.

## Unintentional differences found and fixed
| Found | Fix |
|---|---|
| Review “some missing” capture showed the practice room (capture script raced the navigation) | script waits for `/review` and its heading |
| Owner sign-in: “Back to home” sat beside the Google button | link is a centred block |
| Mobile History: score beside the title, “latest” caption hidden | score moves under the title with the caption (as the prototype) |
| Mobile dashboard deck title truncated | wraps on mobile |
| Deck detail sub-score order differed from the report | same order as the report (Timing, Filler words, Slide coverage, Clarity) |
| Admin ratings average “4” / student-detail date without year | “4.0”; date with year |
| Native number spinner on the minutes field | hidden |
| Admin students table clipped its last column at 1280 px | tighter cell padding; table scrolls inside its card below that |
| Several controls under 44 px on mobile (avatar link, flow exit button, landing footer links, “View all”, input hit areas) | all ≥ 44 px; enforced by `e2e/touch-targets.spec.ts` |

## Known remaining differences (not fixed, judged immaterial)
* Landing headline/paragraph wrap slightly differently at 390 px (balanced wrapping).
* “Microphone access is blocked” title wraps one word earlier; the overrun message on mobile can wrap to its own line.
* “Block student” on the mobile student detail looked light-blue in one capture (hover state of the captured pointer).

## Not covered
* No check on real iOS/Android devices or Safari (see handoff §F).
