# Mock 2 Pitch — Design System

**Mock 2 Pitch** is an AI-powered rehearsal tool for students. A student uploads their slides (PDF/PPTX), turns on the mic and records a practice pitch. The AI analyses voice, timing, filler words and slide coverage, then produces a performance report so the next run is better. Target moments: campus placements, hackathon demos, project seminars. Tagline (from the logo): **PRACTICE • IMPROVE • PITCH**.

Core features (from the brief):
1. AI slide content extraction (PDF and PPTX)
2. AI voice analyser (pace, fillers, confidence)
3. Feedback report generator
4. AI slide script / key-points generator

Products represented: one — the **student web app** (see `ui_kits/web-app/`).

## Sources
Everything here was built from user uploads only. No codebase, Figma file or product screenshots were provided.
- `uploads/WhatsApp Image 2026-10-02 at 8.48.32 PM.jpeg` — logo (copied to `assets/logo.jpeg`)
- `uploads/WhatsApp Image 2026-10-02 at 8.52.33 PM.jpeg` — palette strip (`assets/reference/palette-strip.jpeg`)
- `uploads/WhatsApp Image 2026-10-02 at 8.52.34 PM.jpeg` — named palette (`assets/reference/palette-names.jpeg`)
- `uploads/Primary Font/` — Autour One + LXGW WenKai TC
- `uploads/Secondary font/` — LXGW WenKai TC (same files as in Primary)

Because there is no existing product UI, the components and UI kit are **designed from the brief**, not recreated.

---

## CONTENT FUNDAMENTALS
- **Voice:** a calm, encouraging coach. Direct, specific, never scolding. Students are nervous; copy lowers the stakes.
- **Person:** speak to the student as **you**. The product refers to itself as **we** sparingly ("We'll read your slides…"). Never "I".
- **Specific over vague:** feedback always cites a number and a location. "You spoke at 186 wpm on slide 4. Pause after each block." not "Try to slow down."
- **Lead with a strength**, then the fix. Report headline pattern: *"Clear and confident. Slow down in the middle."*
- **Casing:** Sentence case for headings, buttons and labels ("New practice", "Finish & analyse"). ALL CAPS only for the tracked overline style ("COVER ON THIS SLIDE", tagline).
- **Spelling:** British/Indian English (analyse, practise as verb is acceptable; UI uses "practice" as noun).
- **Numbers:** numerals always ("3 practice runs", "12 fillers", "7:48 / 8:00"). Time as m:ss.
- **Length:** buttons 1–3 words, verb first. Helper text one sentence.
- **Emoji:** none. Use Lucide icons instead.
- **Examples:** "Hi Ananya, ready to rehearse?" · "Press the mic when you're ready. Take a breath first." · "You didn't mention the payback period. It's your strongest number."

## VISUAL FOUNDATIONS
- **Colour:** a five-step blue palette from inky Prussian (#00072D) to Icy Blue (#A6E1FA). Imperial Blue (#0A2472) is the primary action colour; Bright Marine (#0E6BA8) is the accent for links, focus, meters and active states; Icy Blue is text/accents on dark. **Pitch Violet (#7B4DFF)** comes from the logo's play glyph and is reserved for AI-generated content badges and the "2" in a type-set name. Red is used only for recording and errors. Neutrals are navy-tinted ("ink").
- **Two modes of surface:** light app chrome (`--bg-page` #F6F7FB, white cards) for planning and reports; **full-bleed Prussian/Deep Navy** for the practice stage and hero summaries — the dark stage is a deliberate focus mode.
- **Type:** Autour One (rounded, friendly display) for headings, buttons, tabs and big numbers. LXGW WenKai TC (warm kai-style) for body, labels and helper text — it gives a handwritten, notebook feel. Headings never bold (Autour One has one weight); emphasis in body uses WenKai Bold 700.
- **Spacing:** 4px base. Card padding 24 (20 for metric tiles), stack gap 16, section gap 24–28, page padding 36/40.
- **Radii:** soft and friendly — inputs 12, cards 16, dialogs 24, all buttons/badges/tabs are pills. Checkbox 6.
- **Cards:** white, 1px `--ink-200` border, `--shadow-sm` (navy-tinted). Interactive cards lift 1px and go to `--shadow-md` on hover. No coloured left borders.
- **Shadows:** navy-tinted rgba(0,7,45,…), three levels (sm/md/lg). Record button uses a red halo ring instead of a drop shadow.
- **Backgrounds:** flat colour only. No photography, textures or patterns supplied. The only gradient is the logo arc (blue → violet); don't use it as a background.
- **Motif:** the logo's open circular arc + play triangle. Echoed by the ScoreRing (open arc progress) and the circular RecordButton.
- **Animation:** short and calm. 120ms for hover/press, 200ms for toggles, 360ms for progress fills. Easing `cubic-bezier(.22,.8,.3,1)` (ease-out). No bounces; nothing that could add to anxiety.
- **Hover:** solid fills darken one palette step (Imperial → Deep Navy); light/ghost elements get a marine-50 or ink-100 wash. Links go Marine → Imperial with underline.
- **Press:** buttons scale to 0.97 and darken another step.
- **Focus:** 3px Bright Marine ring at 35% (`--focus-ring`).
- **Borders:** 1px hairlines in ink-200; strong borders (ink-300) only on form controls and secondary buttons.
- **Transparency & blur:** only on the dialog scrim (Prussian at 45% + 4px blur) and translucent icy controls on the dark stage.
- **Imagery:** none supplied. If added, keep it cool-toned and calm; slide thumbnails are shown on white with `--shadow-lg`.
- **Layout:** fixed 248px left sidebar, content max 1200px. Practice screen is full-viewport with a 64px top bar and a 320px right rail.

## ICONOGRAPHY
- No icon set was supplied. **Substitution:** [Lucide](https://lucide.dev) via CDN icon font (`lucide-static@0.452.0`), loaded automatically by the `Icon` component. Rounded 2px strokes match Autour One's soft terminals.
- Icons are line-only, sized 16–24, coloured `--bright-marine` inside a marine-50 rounded tile (metric/file rows) or `currentColor` inside buttons.
- No emoji. No unicode glyphs as icons (the tagline's • is typographic).
- Common names: mic, square, upload, file-text, presentation, timer, gauge, message-square-warning, list-checks, sparkles, chart-line, lightbulb, triangle-alert, circle-check.

## Logo
`assets/logo.jpeg` — supplied as a raster JPEG on a near-white background (no vector, no transparent version). Use on white only. On dark surfaces set "Mock2Pitch" in Autour One white with the "2" in Pitch Violet (see Brand cards).

---

## Index
- `styles.css` — entry point (@imports only)
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`
- `fonts/` — Autour One, LXGW WenKai TC (Light/Regular/Bold) + OFL licences
- `assets/` — `logo.jpeg`, `reference/` palette sheets
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React primitives (below), one card per folder
- `ui_kits/web-app/` — student web app click-through
- `SKILL.md` — Agent Skill entry

## Components
- **core/** — Icon, Button, IconButton, Badge, Card
- **forms/** — Input, Select, Checkbox, Radio, Switch, FileDropzone
- **feedback/** — ProgressBar, Toast, Tooltip, Dialog
- **navigation/** — Tabs
- **pitch/** — RecordButton, LevelMeter, MetricCard, ScoreRing, FeedbackItem

No source component inventory existed, so this is a standard set sized to the product. Intentional additions beyond the standard set:
- **Icon** — wrapper for the Lucide substitute set.
- **FileDropzone** — slide upload is the first step of every session.
- **RecordButton, LevelMeter** — the recording stage.
- **MetricCard, ScoreRing, FeedbackItem** — the performance report.

## UI kits
- `ui_kits/web-app/index.html` — Dashboard, Setup (upload + AI key points), Practice (record), Report.
