# Port → Phase 1 backend mapping (what the Supabase adapter must implement in Phase 3)

Source of truth for the shapes: `lib/data/types.ts`. Contracts: `docs/phase-1/api-contracts.md`, `docs/phase-1/supabase.md`. Edge Functions are `POST /functions/v1/<name>` with the user's JWT; RPCs via `supabase.rpc`; direct reads via supabase-js (RLS applies). Every failure must be thrown as `AppError(code, message, details)` using the backend's `error.code` (functions) or `error.message` (RPC exceptions).

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
