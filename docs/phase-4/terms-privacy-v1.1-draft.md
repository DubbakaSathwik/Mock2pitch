# DRAFT — Terms of Use and Privacy Policy v1.1 (for owner approval; not published)

> Drafted by the release lead from v1.0 and from what the product **actually does** (verified in code and in the Phase 3 live tests). It is **not legal advice**; the owner must approve or replace it before launch. Square brackets mark facts only the owner can fill in. Differences from v1.0 are listed at the end.

## Terms of Use

### 1. About Mock2Pitch
Mock2Pitch is a practice tool for students. You upload a PDF of your slides, rehearse out loud one slide at a time in a private virtual jury room, and receive AI-generated feedback after your session. It is not a grading or certification service.

### 2. Who can use it
You sign in with your Google account. You must be at least 18 years old, or have the permission of a parent or guardian. You must give your college, year and branch before you start. You are responsible for the content you upload and for what you say in your recordings.

### 3. What you can upload
PDF files only, up to 10 slides and 5 MB. Upload only material you have the right to use. Do not upload confidential, personal or sensitive information about other people, or anything unlawful.

### 4. Daily limit
You can start up to 5 practice sessions a day. Uploading a new deck and retaking a deck each count as one session. The day resets at midnight, India Standard Time. These limits may change as the service grows.

### 5. AI feedback
Slide reading, speech-to-text and the written report are produced by AI models and may contain mistakes. Scores come from a fixed rubric (coverage, clarity, timing, filler words) and are guidance for practice, not an assessment of you as a person or a guarantee of any result. The filler-word count recognises words such as "like", "basically" and "you know"; short sounds such as "um" may not be detected.

### 6. Acceptable use
Do not misuse the service, try to access other people's data, upload files meant to manipulate the AI, or disrupt the service. We may block accounts that do. A blocked account can still read its reports.

### 7. Availability
The service is provided as is, without a promise of uninterrupted availability. AI providers may be temporarily busy; you can try again.

### 8. Changes to these terms
When the Terms or Privacy Policy change you will be asked to accept the new version before you continue. A practice session you have already started can still be submitted.

### 9. Deleting your account
You can delete your account at any time in Settings. Deletion removes your profile, decks (PDF and slide images), recordings, reports, ratings and acceptances, and cannot be undone.

### 10. Governing law and contact
These terms are governed by the laws of India. Questions: dubbakasathwik@gmail.com.

## Privacy Policy

### 1. What we collect
- From Google when you sign in: your name, email address and profile photo.
- From you: college, year and branch.
- Your PDF and an image of each slide; the key points and script suggestions generated from them.
- Your practice sessions: the time you chose, transcripts of what you said, scores, feedback, and the star rating and comment you give a report.
- Technical data needed to run the service (sign-in session cookies, the time you were last active, usage counts and AI usage counters that contain no slide, transcript or audio content).
We do not record video and we do not use advertising or analytics cookies.

### 2. Slides
Your PDF and slide images are stored privately and are sent to an AI service (NVIDIA-hosted models) to read each slide and suggest key points and a script. They are kept until you delete your account so you can retake a deck.

### 3. Recordings
Audio is recorded one slide at a time, only while you press Record, and is uploaded when you submit. It is sent to an AI speech service (NVIDIA-hosted) to create a transcript and is **deleted as soon as your report is generated**. If a session is never completed, audio is deleted automatically within 24 hours. Reports keep transcripts, scores and feedback, never audio.

### 4. Who can see what
- You see your own decks, transcripts, reports and ratings.
- The owner can see your profile details (name, email, college, year, branch, last active), your sessions per day, the titles of your decks, the date and overall score of each attempt, and the star ratings and comments you write. The owner cannot open your slides, scripts, transcripts or detailed feedback.
- We do not sell or share your data. It is processed on our behalf by: Supabase (database and sign-in), Cloudflare (file storage), Netlify (hosting), Google (sign-in) and NVIDIA (AI models).

### 5. Where data is stored
With the providers above. Cloudflare R2 file storage is located in North America (ENAM) and the Supabase database in [owner: the region shown in Supabase → Project Settings → General]. Your data may therefore be processed outside India.

### 6. Retention
Profile, decks, reports and ratings: until you delete your account (or ask us to). Audio: deleted after the report (see 3). Anonymous AI usage counters (no content, no user identity) may be kept for cost control.

### 7. Your choices and rights
You can edit your profile and delete your account in Settings. To ask for a copy of your data or for help deleting it, contact us (below). You can also ask us to correct your data. We will respond to requests within a reasonable time.

### 8. Children
The service is not intended for people under 18 without a parent or guardian's permission.

### 9. Changes
We will ask you to accept the updated policy before you continue.

### 10. Contact
dubbakasathwik@gmail.com

---

## What changed from v1.0 (and why)
| Change | Reason |
|---|---|
| Admin visibility now lists deck titles, attempt scores/dates and rating comments | v1.0 said the owner sees only "aggregate usage, profile details and star ratings"; the product also shows deck titles, per-attempt score/date and rating comments to the owner (`admin_student_detail`) — text must match behaviour |
| Age, availability, acceptable-use, blocked-account sentences | product behaviour already exists (block keeps read access) |
| Filler-words sentence | Parakeet drops "um/uh" (Phase 3 finding) |
| Audio deletion for unfinished sessions | the sweeper deletes audio after 24 h |
| Processors named; cross-border note; retention; children | completeness; needs owner confirmation of regions/contact |
| Technical data / no analytics cookies | the app sets only the sign-in session cookie |
