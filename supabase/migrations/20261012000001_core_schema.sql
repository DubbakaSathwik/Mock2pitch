-- Mock2Pitch core schema. Idempotent only via fresh `supabase db reset`.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists citext with schema extensions;

-- generic updated_at trigger
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  college text check (college is null or char_length(college) between 1 and 120),
  year text check (year in ('3rd year','4th year','Other')),
  branch text check (branch in ('CSE','IT','ECE','EEE','Mechanical','Civil','Other')),
  profile_completed_at timestamptz,
  role text not null default 'student' check (role in ('student','admin')),
  is_blocked boolean not null default false,
  blocked_at timestamptz,
  deletion_requested_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_last_active_idx on public.profiles (last_active_at desc nulls last);
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- policies (Terms + Privacy together)
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  terms_body text not null check (char_length(terms_body) between 1 and 50000),
  privacy_body text not null check (char_length(privacy_body) between 1 and 50000),
  note text,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null
);
create index policy_versions_published_idx on public.policy_versions (published_at desc);
create index policy_versions_published_by_idx on public.policy_versions (published_by);

create table public.policy_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version_id)
);
create index policy_acceptances_version_idx on public.policy_acceptances (policy_version_id);

-- ---------------------------------------------------------------- decks
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  page_count int check (page_count between 1 and 10),
  status text not null check (status in ('awaiting_upload','uploaded','awaiting_images','processing','ready','failed')),
  processing_stage text,
  processed_slides int not null default 0,
  error_code text,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decks_owner_created_idx on public.decks (owner_id, created_at desc);
create index decks_owner_pinned_idx on public.decks (owner_id, pinned_at desc nulls last);
create index decks_status_updated_idx on public.decks (status, updated_at);
-- one in-flight deck per user (race-safe)
create unique index decks_one_active_per_owner on public.decks (owner_id)
  where status in ('awaiting_upload','uploaded','awaiting_images','processing');
create trigger decks_touch before update on public.decks for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- practice sessions
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number int not null check (attempt_number >= 1),
  total_minutes int not null check (total_minutes between 1 and 20),
  suggested_seconds int[] not null,
  status text not null check (status in ('in_progress','uploading_audio','transcribing','generating_report','completed','failed','abandoned')),
  analysis_stage text,
  error_code text,
  analysis_attempts int not null default 0,
  policy_version_id uuid references public.policy_versions(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index sessions_owner_created_idx on public.practice_sessions (owner_id, created_at desc);
create index sessions_deck_attempt_idx on public.practice_sessions (deck_id, attempt_number);
create index sessions_status_updated_idx on public.practice_sessions (status, updated_at);
create index sessions_policy_version_idx on public.practice_sessions (policy_version_id);
-- Attempt numbers are unique among non-abandoned sessions: a restarted (abandoned) attempt re-uses its number.
create unique index sessions_deck_attempt_uniq on public.practice_sessions (deck_id, attempt_number) where status <> 'abandoned';
-- at most one analysing session per owner (race-safe)
create unique index sessions_one_analysing_per_owner on public.practice_sessions (owner_id)
  where status in ('uploading_audio','transcribing','generating_report');
create trigger sessions_touch before update on public.practice_sessions for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- files (R2 object metadata)
create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid references public.decks(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  kind text not null check (kind in ('deck_pdf','slide_image','audio_clip')),
  slide_index int check (slide_index between 0 and 9),
  bucket text not null,
  object_key text not null unique,
  mime_type text not null,
  size_bytes bigint,
  expected_size_bytes bigint not null,
  status text not null check (status in ('pending','uploaded','deleted','failed')),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  deleted_at timestamptz,
  constraint files_owner_ref check (
    (kind in ('deck_pdf','slide_image') and deck_id is not null and session_id is null) or
    (kind = 'audio_clip' and session_id is not null and deck_id is null)),
  constraint files_slide_index_req check ((kind = 'deck_pdf' and slide_index is null) or (kind <> 'deck_pdf' and slide_index is not null))
);
create unique index files_one_live_pdf on public.files (deck_id) where kind = 'deck_pdf' and status in ('pending','uploaded');
create unique index files_one_live_image on public.files (deck_id, slide_index) where kind = 'slide_image' and status in ('pending','uploaded');
create unique index files_one_live_clip on public.files (session_id, slide_index) where kind = 'audio_clip' and status in ('pending','uploaded');
create index files_status_created_idx on public.files (status, created_at);
create index files_session_idx on public.files (session_id);
create index files_deck_idx on public.files (deck_id);
create index files_owner_idx on public.files (owner_id);

-- ---------------------------------------------------------------- slides
create table public.slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  slide_index int not null check (slide_index between 0 and 9),
  title text,
  extracted_text text,
  key_points text[] not null default '{}' check (cardinality(key_points) <= 5),
  suggested_script text check (suggested_script is null or char_length(suggested_script) <= 1500),
  time_weight int not null check (time_weight between 1 and 100),
  image_file_id uuid references public.files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, slide_index)
);
create index slides_image_file_idx on public.slides (image_file_id);
create trigger slides_touch before update on public.slides for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- daily-limit ledger
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('upload','retake')),
  deck_id uuid,
  session_id uuid,
  local_date date not null,
  created_at timestamptz not null default now()
);
create index usage_events_user_date_idx on public.usage_events (user_id, local_date);

-- ---------------------------------------------------------------- results + reports
create table public.session_slide_results (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  slide_index int not null check (slide_index between 0 and 9),
  duration_ms int not null default 0,
  suggested_seconds int not null default 0,
  word_count int,
  wpm numeric(6,1),
  transcript text,
  word_timings jsonb,
  filler_count int,
  fillers jsonb,
  key_points_covered int[],
  key_points_missed int[],
  off_topic_quotes text[],
  slide_feedback text,
  primary key (session_id, slide_index)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.practice_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  attempt_number int not null,
  overall_score int not null check (overall_score between 0 and 100),
  coverage_score int not null check (coverage_score between 0 and 100),
  clarity_score int not null check (clarity_score between 0 and 100),
  timing_score int not null check (timing_score between 0 and 100),
  filler_score int not null check (filler_score between 0 and 100),
  overall_wpm numeric(6,1),
  total_duration_ms int,
  key_points_covered int,
  key_points_total int,
  filler_total int,
  headline text not null check (char_length(headline) <= 140),
  top_fixes text[] not null check (cardinality(top_fixes) = 3),
  did_well text[] not null check (cardinality(did_well) = 3),
  delta_from_first int,
  first_attempt_score int,
  scoring_version text not null,
  models jsonb,
  created_at timestamptz not null default now()
);
create index reports_owner_created_idx on public.reports (owner_id, created_at desc);
create index reports_deck_attempt_idx on public.reports (deck_id, attempt_number);

create table public.report_ratings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index report_ratings_user_idx on public.report_ratings (user_id);

-- ---------------------------------------------------------------- AI key metadata (never the secret)
create table public.ai_key_slots (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('slide_reading','speech_to_text','report_generation')),
  slot text not null check (slot in ('primary','fallback_1','fallback_2')),
  credit_limit int not null default 1000 check (credit_limit >= 0),
  credit_period_start timestamptz not null default now(),
  cooldown_until timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now(),
  unique (purpose, slot)
);
create trigger ai_key_slots_touch before update on public.ai_key_slots for each row execute function private.touch_updated_at();

create table public.ai_usage_log (
  id bigint generated always as identity primary key,
  purpose text not null check (purpose in ('slide_reading','speech_to_text','report_generation')),
  key_slot_id uuid references public.ai_key_slots(id) on delete set null,
  model text,
  user_id uuid references public.profiles(id) on delete set null,
  deck_id uuid,   -- no FK: usage history outlives content
  session_id uuid,
  outcome text not null check (outcome in ('success','rate_limited','server_error','timeout','bad_request','invalid_output')),
  http_status int,
  latency_ms int,
  prompt_tokens int,
  completion_tokens int,
  audio_ms int,
  created_at timestamptz not null default now()
);
create index ai_usage_slot_created_idx on public.ai_usage_log (key_slot_id, created_at);
create index ai_usage_purpose_created_idx on public.ai_usage_log (purpose, created_at);
create index ai_usage_created_idx on public.ai_usage_log (created_at);
create index ai_usage_user_idx on public.ai_usage_log (user_id);

-- ---------------------------------------------------------------- admin audit + deletion bookkeeping (not exposed)
create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_admin_idx on public.admin_actions (admin_id);

create table private.pending_deletions (
  user_id uuid primary key,
  prefix text not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table private.owner_allowlist (
  email extensions.citext primary key,
  added_at timestamptz not null default now()
);
