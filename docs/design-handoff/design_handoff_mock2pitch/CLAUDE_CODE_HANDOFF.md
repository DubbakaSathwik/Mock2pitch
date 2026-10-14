# Mock2Pitch — Claude Code Handoff (FINAL design)

This bundle is the **single source of truth** for the final Mock2Pitch prototype, including every change requested after the first build (see "Changes after initial implementation").

## 1. What this is
Mock2Pitch is an AI rehearsal tool for students: upload slides (PPTX/PDF, ≤10), present out loud slide-by-slide to a virtual jury (audio only), get a scored feedback report. There is also an owner-only admin area.

**The files here are design references built in HTML/React**, not production code. Recreate them in the target stack (recommended if starting fresh: React + TypeScript + Vite, CSS variables from `design-system/tokens`, Lucide icons via `lucide-react`). Fidelity: **high-fidelity** — colours, type, spacing, copy and interactions are final. All data is mocked (see §8).

## 2. Run the prototype
Open `prototype/index.html` in a browser (serve the folder, e.g. `npx serve prototype` — Babel loads `src/m2p-app.jsx` via XHR so `file://` may be blocked in some browsers). Everything is vendored: React 18.3.1, ReactDOM 18.3.1, Babel standalone 7.29.0, Lucide icon font 0.452.0, all fonts. No network needed.

The floating violet **"Screens"** button (bottom-right) is a prototype-only jump menu: it jumps to every screen/state and toggles **Desktop / Mobile 390** frame. Do not ship it. Also prototype-only: "Prototype shortcuts" card on Upload, "Demo: block it" on Mic check, "Fill with sample recordings" on Review.

## 3. Project structure
```
design_handoff_mock2pitch/
├─ CLAUDE_CODE_HANDOFF.md        ← this file
├─ prototype/                    ← runnable, offline, FINAL
│  ├─ index.html                 entry; global keyframes + resets
│  ├─ src/m2p-app.jsx            ALL screens, data, state, interactions (single file)
│  ├─ design-system/
│  │  ├─ _ds_bundle.js           compiled DS components (window.Mock2PitchDesignSystem_feb8de); icon CSS path patched to local
│  │  ├─ styles.css              @imports tokens
│  │  ├─ tokens/{fonts,colors,typography,spacing,base}.css
│  │  └─ fonts/                  AutourOne-Regular.ttf, LXGWWenKaiTC-Regular.ttf, LXGWWenKaiTC-Bold.ttf + OFL licences (the ONLY copy of the fonts)
│  ├─ vendor/                    react, react-dom, babel, lucide/{lucide.css, lucide.woff2}
│  └─ assets/
│     ├─ logo.jpeg               official raster logo (white bg only)
│     └─ svg/                    google-g, star-filled, star-empty, audience-person, logo-mark (extracted from inline JSX)
├─ design-system-source/         full DS source: components/*.jsx (+ cards), guidelines/*.html, tokens, assets, README, SKILL.md (fonts/ holds licences + pointer; tokens/fonts.css points at prototype/design-system/fonts)
└─ original-dc/                  the authoring files as they exist in the design tool (Mock2Pitch Prototype.dc.html + m2p-app.jsx + support.js). Reference only; paths to _ds/ are not bundled there — use prototype/.
```
`prototype/src/m2p-app.jsx` and `original-dc/m2p-app.jsx` are identical (final).

## 4. Screen sizes & breakpoints
There is **one responsive layout system with one breakpoint**, measured on the app container width (not window): `m = containerWidth < 760`.
| Size | Viewport | Trigger |
|---|---|---|
| Landing hero only | extra breakpoint at 1100px: below it the hero stacks to 1 column (no overlapping card) | width < 1100 |
| Desktop | any width ≥ 760px (designed at 1280–1440 × 800–900; content max 1200px, flows 1152/1280 inner) | default |
| Mobile | 390 × 844 (iPhone 12–15 class). Prototype frame: 390 wide, height min(844px, 100vh−24px), 8px #0b1030 bezel, radius 38 | width < 760 (also any narrow desktop window) |
No tablet-specific layout: 760–1024 uses desktop layout. Mobile layouts are **intentionally different** (bottom tab bars, stacked cards, different control dock), not merely shrunk — details per screen in §5, summary in §6.

## 5. Screens (all states)
IDs match the Screens menu. Fonts: **display = Autour One 400** (headings, buttons, numbers, nav); **body = LXGW WenKai TC** 400/700. Headings never bold.

### Shells
- **Student shell (desktop):** 248px white sidebar (border-right ink-200, padding 20): Logo, nav pills (Home `house`, New practice `circle-plus`, History `history`, Profile `user`; 44px tall, radius 999, active bg marine-50 / text imperial), bottom "Practice sessions today" sunken card with ProgressBar (n of 5), user row (avatar 36 + name + "year · branch"). Main: padding 36/40, max-width 1200 (report 1000, settings 860).
- **Student shell (mobile):** 56px white top bar (Logo 18 + avatar 32), scroll content padding 16, **bottom tab bar** 4 cols (icon 22 + label 12, min-height 56). Sessions card/user row hidden.
- **Flow shell** (Upload/Prep/Time/Mic/Review): 64px (mobile 56) top bar: Logo, 4-step stepper (Upload, Prepare, Time, Mic check; 24px circles: done=success with check, current=imperial, future=ink-100; labels hidden on mobile), close IconButton `x` → Dashboard. Content max 760 (Prep: 1280), padding 32/40 (mobile 16).
- **Admin shell (desktop):** 248px **Prussian** sidebar, Logo (white) + violet "Owner admin" badge, nav: Overview `layout-dashboard`, Students `users`, Ratings `star`, AI usage `cpu`, Terms `file-text`; active rgba(166,225,250,.16) white text; Sign out `log-out`. **Mobile:** Prussian 56px top bar + 5-col Prussian bottom tab bar.

### Guest
- **S1 Landing** — header 72px (Logo, "Sign in" secondary sm). Hero 2-col (1.05fr/.95fr, gap 64; mobile 1 col gap 32): overline "PRACTICE • IMPROVE • PITCH", H 56px (mobile 38) "Rehearse your pitch in private. Walk in ready.", body 18, Google button, muted "Free to start · Audio only, no camera · English". Right: RoomPreview with ReportPreview card overlapping (absolute right 0, bottom −48, 62% width) **only when container ≥ 1100px**; below 1100px (incl. mobile) the hero is 1 column and the report card stacks under the room preview (max-width 520). Sections: How it works (3 cards → 1 col mobile), Practice room + Feedback report (2 col → 1), Prussian privacy band radius 24 (3 rows: mic / trash-2 / lock), footer (Terms, Privacy Policy, Owner sign in).
- **S2 Sign in** — centered card 460, "Welcome back", Google button, shield-check note, "Back to home".
- **S3 Terms** — card 760. States: *first time* ("Before you start"), *updated* (marine-50 banner with version + date, triggered when admin publishes), *view-only* (from Settings/footer, Back link, no checkbox). Pill tabs Terms / Privacy Policy, scroll box 320 (mobile 280) ink-50, Checkbox "I have read and agree…", Continue disabled until checked. Doc format: "## Heading" lines.
- **S4 Profile setup** — "Step 2 of 2", Google identity row, College Input (required → error "Enter your college name"), Year Select (3rd year/4th year/Other), Branch Select (CSE, IT, ECE, EEE, Mechanical, Civil, Other); 2-col → 1 col mobile.

### Student
- **S5 Dashboard** — Head "Hi {first}, ready to rehearse?" + "Start a new practice" lg (mobile: full-width button below header). Grid 1.6fr/1fr (mobile 1 col). Left: *empty* = centered card "Your first practice starts here"; *with history* = "Recent decks" row (ParkSense…, latest score coloured). "Your progress" LineChart (empty placeholder text when 0 attempts). Right: **Today's usage** card (ProgressBar label "Practice sessions", "n of 5 sessions", reset note) then **"Your practice so far"** card: *0 attempts* → mic tile 48, "Ready for your first practice", muted helper, "Start now" sm; *≥1 attempt* → 2×2 tiles (ink-50, radius 12, pad 14): Average score, Best score, Practice time, Key points. (Tip for today box was REMOVED.)
- **S6 Upload** — dashed dropzone (2px, radius 20, hover/drag → marine-50 + marine border), click opens file picker (.pptx,.pdf). **Errors render BELOW the dropzone** (danger-50 box, triangle-alert, bold red title + muted body): wrong type / "That deck has 14 slides" / Upload failed. Valid file → S7.
- **S7 Extracting** — AI badge, stage text cycles (550ms ticks), ProgressBar, 8 slide thumbs fade/slide in (4 cols → 2 mobile), auto-advance to Prep.
- **S8 Slide prep** — desktop 3 cols (170 thumb rail / slide 16:9 + prev/next / 360 right: Key points + Suggested script cards with violet AI badge). Mobile: slide, horizontal thumb scroller (108px), pill toggle Key points/Script, full-width Continue.
- **S9 Set time** — number Input (1–20; errors "Enter at least 1 minute" / "The maximum is 20 minutes"), preset pills 3/5/7/10 min, per-slide table (weights 20/40/40/50/40/40/40/30 of 300 → seconds), bar column hidden mobile, timer note, Continue.
- **S10 Mic check** — states *idle* (Allow microphone), *granted* (success badge + 28-bar animated level meter, level label), *denied* (3-step fix list + Try again). Right "Before you enter" checklist. Enter button disabled until granted.
- **S11 Practice room** (dark Prussian, full-bleed). Desktop: 64px bar (Logo, deck + slide n of 8, slide timer pill [turns **danger red** when over suggested], total timer pill, "Review and submit" inverse); body grid 1fr / 320px: slide + status line + slide strip (thumbs 112 with status dot: Not recorded / Recording [pulsing] / Recorded / Over time) | right rail: 2×3 grid of 5 jury tiles + "You" tile (glow ring scales with live level), collapsible "My notes" (key points). Bottom floating dock (deep-navy pill): Previous, **Record** (56 red, halo), Stop, Play back, Re-record, Next, **End** (red 68×48 pill, Lucide `phone` rotated 135° = hang-up). Mobile: 52px bar (Slide n/8, total), scroll body (slide, 6-col mini tiles, strip 76px, notes, Review button), fixed bottom sheet (deep-navy, radius 20 top) with timers + controls (44 min width). States: before recording, recording, recorded, overrun, End-confirm Dialog ("Leave this session?" → Keep practising / Leave session). Controls disabled while recording except Stop/End.
- **S12 Review** — warning banner if slides missing, row per slide (duration badge success/warning, Play/Re-record IconButtons 44), audio-deletion note, "Back to practice room" / "Submit for feedback" (dialog if missing slides).
- **S13 Analysing** — Prussian full screen, 88px spinner, rotating status copy, progress bar; after 5s → Report (increments attempts + sessions).
- **S14 Report** — Prussian hero (ScoreRing 168/140, icy on dark), headline, retake delta pill "+12 from your first attempt (62)". 5 sub-score cards (5 cols → 2 cols mobile, 5th spans). Top 3 fixes / What you did well (2 col → 1). Slide-by-slide accordion (time, points, fillers badges; expanded: key points covered/missed, time+filler counts, off-topic quotes, transcript with highlighted fillers). **Rate this report: exactly 5 star buttons** (32px, fill #E8A317 up to selection) + optional comment + Send rating → thank-you state + toast. Retake / Back to dashboard. Two variants: attempt 1 (62) and retake (74).
- **S15 History** — empty state card; or deck card row: tile, title (+ "Pinned" warning badge when pinned), meta, **star pin button** (44×44, toggles pinned, toast "Deck pinned to top"/"Deck unpinned", stopPropagation), latest score, chevron. **The mini progress chart was REMOVED** from this card.
- **S16 Deck detail** — score trend LineChart, sub-scores attempt 1 vs 2 bars, attempts list → Report.
- **S17 Settings** — profile edit (toast "Profile saved"), usage limits 3 tiles, Terms/Privacy links (view-only), Sign out.
- **S18 Limit reached** — moon tile, "That's 5 sessions today. Time to rest.", full ProgressBar, Review reports / Back. Triggered when starting a practice with used ≥ 5.

### Admin
- **A0 Owner sign in** — card with violet badge + Google button.
- **A1 Overview** — 4 Stat cards (4 cols → 2 mobile). **Sessions per day** BarChart (FIXED): 14 bars, heights proportional to max, x-axis date labels every 2nd day "23 Sep … 6 Oct" (last label always shown), last bar imperial + value label, others marine-200, baseline ink-200; subtitle "23 Sep to 6 Oct 2026". Recent ratings list (4) → View all.
- **A2 Students** — search Input (name/email/college), desktop 9-col table, mobile cards; Block/Unblock toggles (red "Blocked" badge, row 60% opacity, toast).
- **A3 Student detail** — profile card + Block button, attempts list, ratings given.
- **A4 Ratings** — average card, filter pills All/5…1, rows (5 col → stacked mobile), empty filter state.
- **A5 AI usage** — 4 cards (Speech to text, Slide reader, Script and key points, Report analysis): masked key (mono), "Running low" badge >75%, ProgressBar, Used / Remaining. **Chart labelled "Credits used per day"**: 7 bars with x-axis labels 30 Sep … 6 Oct and a value above every bar; last day highlighted imperial.
- **A6 Terms & Privacy** — tabbed textarea editor, Version history (Live badge), Publish dialog → creates new version, sets everyone to re-accept (student next sign-in shows S3 updated).

## 6. Responsive summary (desktop → mobile <760)
- Sidebars (student & admin) → top bar + bottom tab bar; sessions widget and user row disappear.
- All multi-column grids collapse to 1 column, except: report sub-scores 2 cols, admin stats 2 cols, room jury tiles 6-col mini row.
- Tables (Students, Ratings, Review, Time, Report rows) → stacked cards / reduced columns; Time hides the bar column; Review & Report hide the index column and prefix "n." to titles; Report row hides points/fillers badges & chevron.
- Primary CTAs become full-width (Dashboard, Prep, Time, Mic, Review stacked buttons).
- Stepper labels hidden (numbers only). Logo 22 → 18.
- Prep: 3-col → stacked with horizontal thumbs + Key points/Script toggle.
- Practice room: floating dock → fixed bottom sheet; header timers move into sheet; Review button moves into body; right rail moves inline.
- Landing: hero overlap card becomes stacked; hero H 56 → 38.
- Upload copy: "Drag your slides here" → "Tap to choose your slides".
- Touch targets ≥44px on mobile.

## 7. Design system
Bound DS: **Mock 2 Pitch Design System** (full source in `design-system-source/`, guide in its README.md). Components used from the bundle: **Button** (variants primary/secondary/ghost/accent/inverse/record; sizes sm/md/lg; iconLeft/iconRight; fullWidth; disabled), **IconButton**, **Icon** (Lucide font, `className="icon-{name}"`), **Badge** (tones neutral/info/success/warning/danger/violet; dot), **Card** (variants default/sunken/accent; padding; interactive), **ScoreRing**, **ProgressBar** (value/max/label/valueLabel/tone), **Input** (label/error/icon), **Select**, **Checkbox**, **Dialog** (open/title/actions/onClose/width). DS components present but not used in this flow: Radio, Switch, FileDropzone, Toast, Tooltip, Tabs, RecordButton, LevelMeter, MetricCard, FeedbackItem (bespoke equivalents exist inline in app).

App-local components (in m2p-app.jsx): Logo, Overline, H, P, Muted, Tile, AIBadge, Google button, Star/Stars, Avatar, SlideView (16:9, container-query text), LineChart (SVG), BarChart (div bars + labels), Bar, Person (animated jury SVG), SelfTile, Shell/Flow/AShell/Center/Head, Stat, Doc, Hl (filler highlight), JumpMenu (prototype only).

### Tokens
Colours (tokens/colors.css): prussian #00072D, deep-navy #001C55, imperial #0A2472 (primary action), bright-marine #0E6BA8 (accent/links), icy #A6E1FA, pitch-violet #7B4DFF / soft #EEE8FF (AI only), marine 50 #EEF8FE /100 #D6F0FC /200 #A6E1FA /400 #3E95CF /600 #0B5A8E /700 #084770, ink 900 #00072D /800 #141B3D /700 #2E3557 /600 #4A5173 /500 #6B718F /400 #9196AE /300 #BCC0D1 /200 #DDE0EA /100 #ECEEF4 /50 #F6F7FB, success #1F9D6B/#E6F6EF, warning #D98A0B/#FDF3E1, danger #D64545/#FCEAEA. App-only literals: star #E8A317, logo arc #2F5BF0, jury tile tones #16336f #0c2a5e #1d3f86 #0f2457 #23458f, filler highlight text #9A6106, delta pill text #9CF0CB.
Score colour rule: ≥75 success, ≥60 marine, else warning.
Spacing: 4px base (0,4,8,12,16,20,24,32,40,48,64,80). Radii: 6/8/12/16/24/pill 999. Shadows: sm/md/lg navy-tinted, record halo `0 0 0 6px rgba(214,69,69,.18)`. Easing cubic-bezier(.22,.8,.3,1); 120/200/360ms.
Typography (tokens/typography.css):
```css
:root{
--font-display:"Autour One","Trebuchet MS",system-ui,sans-serif;
--font-body:"LXGW WenKai TC","Kaiti TC","STKaiti",Georgia,serif;
--font-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;

--weight-light:300;/* @kind other */--weight-regular:400;/* @kind other */--weight-bold:700;/* @kind other */

--text-display-xl:64px;--lh-display-xl:1.05;/* @kind other */
--text-display-l:44px;--lh-display-l:1.1;/* @kind other */
--text-h1:32px;--lh-h1:1.2;/* @kind other */
--text-h2:24px;--lh-h2:1.25;/* @kind other */
--text-h3:19px;--lh-h3:1.3;/* @kind other */
--text-body-l:18px;--lh-body-l:1.6;/* @kind other */
--text-body:16px;--lh-body:1.6;/* @kind other */
--text-body-s:14px;--lh-body-s:1.5;/* @kind other */
--text-caption:12px;--lh-caption:1.4;/* @kind other */
--text-overline:12px;--tracking-overline:.24em;/* @kind other */
--text-metric:40px;
}
```

## 8. State & data
Single state object (`INIT` in m2p-app.jsx): screen, frame, profile{name,email,college,year,branch}, profileDone, accepted, termsUpdate, termsView, back, attempts (0–2), used (sessions today), reportId, retake, cur (slide), recs {slideIdx:{dur}}, minutes, mic ('idle'|'granted'|'denied'), sel, uploadErr ('type'|'count'|'fail'|null), preset (room demo state), toast, blocked[], sid, pinned, terms, priv, versions[]. Navigation = `go(screen, patch)`. Last screen persisted to localStorage `m2p-screen`. Limits: 5 sessions/day, 10 slides, 20 minutes. Mock data: SL (8 ParkSense slides with key points, scripts, transcripts, missed/off-topic per attempt), REPORT {1,2}, STUDENTS (10), RATINGS (8), AI (4 services), AUD (5 jury). Suggested seconds per slide = round(minutes·60·weight/300). Filler regex: um|uh|like|basically|you know|actually.

Real backend needs: Google OAuth; file upload + slide text extraction; LLM key points/script; per-slide audio capture (MediaRecorder) & STT; analysis → scores; audio deletion after report; ratings; admin endpoints; terms versioning with forced re-accept (never during an active session).

## 9. Interactions & motion
Screen enter: `m2pIn` 300ms fade+6px rise. Toast: bottom-centre Prussian pill, 2.6s. Buttons press scale .97. Jury tiles: `m2pNod` (6–11s) head sway + `m2pBlink`. Recording dot `m2pPulse` 1.2s. Analysing spinner `m2pSpin` 1.1s. Progress fills 360ms ease-out. Mic level updates every 120ms (random in prototype → real analyser node). Recording timer 1s ticks; overrun never stops recording. Playback simulated (≤6s progress bar).

## 10. Assets & where used
- Fonts: Autour One 400 (all display), LXGW WenKai TC 400/700 (body). OFL licences included. LXGW WenKai TC Light 300 is unused in the design and was dropped to fit the 30 MB limit (free from Google Fonts if ever needed). Note: WenKai TTFs are ~12 MB each because they contain CJK glyphs; for production, subset to Latin (e.g. pyftsubset / glyphhanger) to get ~100 KB each.
- `assets/logo.jpeg`: official logo (use on white only). In-app logo is CSS-drawn (`Logo` component; SVG approximation `assets/svg/logo-mark.svg`), white variant on dark.
- `assets/svg/google-g.svg`: Google buttons (Landing, Sign in, Owner sign in).
- `assets/svg/star-*.svg`: report rating, admin ratings, history pin.
- `assets/svg/audience-person.svg`: practice-room jury tiles & landing preview.
- Lucide icons used (55): arrow-right, ban, chart-line, check, chevron-down, chevron-left, chevron-right, chevron-up, circle-check, circle-dot, circle-plus, circle-x, cpu, file-text, gauge, heart, history, house, layers, layout-dashboard, list-checks, lock, log-out, message-circle, message-square-text, message-square-warning, mic, mic-off, moon, notebook-pen, phone, play, plus, presentation, rotate-ccw, search, shield-check, sparkles, square, star, target, timer, trash-2, trending-up, triangle-alert, upload, user, users, volume-2, volume-x, x (+ `phone` rotated 135° for End). Whole Lucide 0.452.0 icon font (woff2, all ~1,500 icons) is vendored, so every icon resolves offline. In production use lucide-react with the same names.
- No photos or raster illustrations exist; slide thumbnails are rendered HTML (SlideView).

## 11. Changes after initial implementation (all reflected)
1. Dashboard: added "Your practice so far" metrics card (Average score, Best score, Practice time, Key points); first-time state "Ready for your first practice" + Start now.
2. Upload: error message moved from above to **below** the dropzone.
3. Practice room: Leave button → red pill **End** call button (hang-up phone icon), label "End".
4. Report rating: fixed bug where each of the 5 buttons rendered 5 stars (25 stars); now exactly 5 single stars.
5. History: removed mini progress chart from deck card; added star **pin** toggle + "Pinned" badge.
6. Admin Overview: rebuilt Sessions-per-day chart (correct proportional heights, baseline, proper date labels).
7. Admin AI usage: charts titled "Credits used per day" with x-axis date labels and per-bar values.
8. Dashboard: "Tip for today" card removed.

## 12. Package size
Kept under 30 MB by storing each font once, dropping the unused Light weight and keeping only the woff2 Lucide font (all modern browsers). Nothing visible in the design was removed: every screen, text, logo, icon, and the full design system are included.

## 13. Known limitations
- Everything is mocked: no real auth, upload parsing, recording, STT or AI. File input only validates extension.
- Pinning has one deck to act on; production should sort pinned decks to top.
- Lucide is a substitute icon set chosen by the design system (no brand icons were supplied).
- `original-dc/` files depend on the design tool runtime and `_ds/` path; use `prototype/` to run.
