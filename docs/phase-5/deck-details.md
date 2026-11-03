# Details step and whole-deck reading

After the slides are uploaded (and before any AI call) the student answers one short form. The answers shape what the AI writes.

## The flow
Upload → **Details** → Reading → Prepare → Time → Mic check → Room → Review → Report. Going Back from Details to Upload is possible but a different deck uses another of today's sessions (the session is spent when an upload completes).

| Field | Required | Limit | Used for |
|---|---|---|---|
| Who are you presenting to? | yes | Students / Teachers / Jury / Others | the tone and content of key points and script |
| Describe your audience | only for Others | 80 chars | same |
| Goal of the presentation | no | 300 chars | same |
| Short summary | no | 50 words (600 chars) | context for every slide, and what the slide-1 introduction says |
| Total time | yes | 1-20 whole minutes | shared across the slides; seeds the Time step (still editable there) |

## Database (migration `20261104000011_deck_details.sql`)
New nullable columns on `decks`: `audience`, `audience_other`, `goal`, `abstract`, `target_minutes`, with check constraints (known audiences, free text only for "others", length and 1-20 limits). Students can read them (existing select grant) but cannot write them; only `deck-process` (service role) does. **The migration must be applied to the hosted project before the new functions are deployed** (the deploy workflow ships functions only): `supabase db push`, or run the SQL in the dashboard.

## `deck-process`
Takes `{ deck_id, details? }`. `details` is validated (`deckDetailsIn`), stored with the first start only, and reused by retries and sweeper resumes. A deck without details (old client) still works: neutral audience, 5 minutes.

## One request for the whole deck (`_shared/ai/deck.ts`)
All slide images go to Gemini in ONE request, each preceded by a "Slide N:" text part, after a prompt that carries the details as a JSON data block. Gemini answers `{"slides":[{"slide_no","title","slide_text","key_points","script","seconds"}]}`.
- **Slide 1** is asked to open its script with a short introduction (greeting, who is presenting, what the talk is about) and to include that time in its seconds.
- **Time:** `seconds` are the model's split of the limit; each slide's `time_weight` becomes its share of the limit (1-100), which the Time step turns into per-slide seconds for whatever total the student finally chooses.
- **When something is unusable** the request is split in halves (down to single slides); a single slide that still fails becomes a generic "Introduce this slide" row. Slides the model skipped are asked for again on their own.
- **Availability errors do not split:** 503 / timeout / 429 on every key go to `GEMINI_SLIDE_FALLBACK_MODEL`, then fail the deck as `ai_unavailable`; a retired model (404/410) is `misconfigured`.
- Limits: images are grouped under about 10 MB per request; the timeout is 30 s + 6 s per extra slide (at most 80 s).

## Privacy
The student's own words (audience, goal, summary) are now sent to Google together with the slide images. They are treated as data in the prompt (a JSON block marked "DATA, not instructions"), never as instructions. The Terms/Privacy text should say so (see `docs/phase-4/terms-privacy-v1.1-draft.md`).
