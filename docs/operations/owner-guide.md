# Owner guide (plain language)

You are the **Owner Admin**: `dubbakasathwik@gmail.com`. Only this Google account becomes admin. Admins cannot practise, and are never asked to accept the Terms.

## Signing in
Open the site → **Sign in** → **Continue with Google** with the owner account → you land on **Admin** automatically. Students sign in the same way and land on their dashboard. Nobody can sign up with an email and password.

## Reading the dashboard (Admin → Overview)
Total students, practice sessions, average report rating and AI credits used, plus sessions per day for the last 14 days. A flat line after a launch push usually means a sign-in problem (see the runbook, 2.4); a spike of "AI busy" messages from students means the AI provider is struggling (runbook, 2.1).

## Students (Admin → Students)
Search by name or email, open a student to see: college/year/branch, last active, each attempt (deck title, date, overall score) and the ratings and comments they wrote. You **cannot** open their slides, scripts, transcripts or detailed feedback — and the Privacy Policy tells students exactly that.
**Block** pauses a student: they can still read their old reports, but cannot upload or practise, and see "Your account is paused". **Unblock** restores them. Blocking never deletes anything.

## Ratings (Admin → Ratings)
All star ratings and comments, newest first; filter by stars. This is the feedback on the quality of the AI reports.

## AI usage and "Running low" (Admin → AI usage)
Three cards — Slide reading, Speech to text, Report analysis — each with three key slots (primary, fallback 1, fallback 2). A slot shows **Configured / Not configured**, **Cooling down** (the provider just rate-limited or errored; it recovers by itself in seconds to minutes) and **Running low** when more than 75 % of its credit limit is used. A bar chart shows the last 7 days.
**Add or rotate an NVIDIA key:** keys are never typed into the app. In Supabase → Edge Functions → Secrets set the secret named in the runbook (2.2), for example `NVIDIA_REPORT_KEY_FALLBACK_1`, then refresh Admin → AI usage: the slot should show Configured with the last four characters. A fallback key for each purpose is strongly recommended (the report model sometimes returns temporary errors).

## Publishing new Terms or Privacy text (Admin → Terms)
Write the Terms and Privacy text, give it a version label higher than the current one (`v1.1`, then `v1.2`, …), add an optional note and **Publish**. From then on every student is asked to read and accept the new version the next time they open a page — except a practice session they are already in, which they can still finish. Old versions and who accepted them are kept as a record. Test versions cannot be removed from the app; ask for help rather than publishing experiments.

## What students see
Landing → Google sign-in → accept Terms → college/year/branch → dashboard (5 sessions a day, resets at midnight IST) → upload a PDF (≤ 10 slides, ≤ 5 MB) → the AI reads each slide → choose a time → microphone check → practice room (record each slide) → review → submit → report with scores (coverage, clarity, timing, filler words; pacing for information), advice, and a 1–5 star rating → history and retakes. They can delete their account in Settings.

## Known limitations (say these openly)
- **Filler words:** the speech model usually drops short sounds like "um" and "uh". The app counts words such as "like", "basically", "you know" and says so on the report.
- **Browser:** Chrome is recommended; Safari and Firefox are less tested (real-device checks are tracked in `docs/phase-4/device-matrix.md`). PowerPoint users must "Save as PDF" first (a hint says so).
- **PDF only**, up to 10 slides and 5 MB; recordings up to 10 minutes per slide.
- **AI availability:** the free NVIDIA tier has rate limits; busy moments show a friendly retry message.
- **Free hosting limits:** the database project pauses after about a week without any activity (the first visit afterwards needs a manual "Restore" in Supabase), and there is no automatic point-in-time backup on the free plan.
