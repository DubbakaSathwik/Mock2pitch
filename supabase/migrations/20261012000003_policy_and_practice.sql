-- Policy versioning, practice rules, daily limit, student RPCs and views.
-- Error contract: SQL raises `exception '<code>'` so PostgREST returns {message:'<code>'}.

create or replace function public.ist_date(p_ts timestamptz) returns date
language sql immutable parallel safe set search_path = '' as $$
  select (p_ts at time zone 'Asia/Kolkata')::date
$$;
grant execute on function public.ist_date(timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- policy
create or replace function private.has_accepted_latest(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select exists (select 1 from public.policy_acceptances a where a.user_id = p_uid and a.policy_version_id = lv.id)
       from (select id from public.policy_versions order by published_at desc, id desc limit 1) lv),
    true)  -- no policy published yet => nothing to accept
$$;

create or replace function public.has_accepted_latest_policy() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_accepted_latest((select auth.uid()))
$$;
revoke all on function public.has_accepted_latest_policy() from public, anon;
grant execute on function public.has_accepted_latest_policy() to authenticated, service_role;

create or replace function public.accept_policy(p_version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_latest uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if private.is_admin() then raise exception 'is_admin'; end if;
  select id into v_latest from public.policy_versions order by published_at desc, id desc limit 1;
  if v_latest is null or v_latest <> p_version_id then raise exception 'not_latest_policy'; end if;
  insert into public.policy_acceptances (user_id, policy_version_id) values (v_uid, p_version_id) on conflict do nothing;
end $$;
revoke all on function public.accept_policy(uuid) from public, anon;
grant execute on function public.accept_policy(uuid) to authenticated;

-- ---------------------------------------------------------------- daily limit
create or replace function private.sessions_used_today(p_uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.usage_events e where e.user_id = p_uid and e.local_date = public.ist_date(now())
$$;

create or replace function private.assert_can_practise(p_uid uuid, p_check_limit boolean default true, p_require_policy boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  if p_uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = p_uid;
  if not found then raise exception 'not_authenticated'; end if;
  if p.role = 'admin' then raise exception 'is_admin'; end if;
  if p.is_blocked then raise exception 'blocked'; end if;
  if p.profile_completed_at is null then raise exception 'profile_incomplete'; end if;
  if p_require_policy and not private.has_accepted_latest(p_uid) then raise exception 'policy_not_accepted'; end if;
  if p_check_limit and private.sessions_used_today(p_uid) >= 5 then raise exception 'daily_limit_reached'; end if;
end $$;

-- Atomically check today's count (IST) < 5 and record the consumption. Race-safe via per-user advisory lock.
create or replace function private.consume_daily_session(p_uid uuid, p_kind text, p_deck_id uuid, p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_uid::text));
  if private.sessions_used_today(p_uid) >= 5 then raise exception 'daily_limit_reached'; end if;
  insert into public.usage_events (user_id, kind, deck_id, session_id, local_date)
  values (p_uid, p_kind, p_deck_id, p_session_id, public.ist_date(now()));
end $$;

-- Student-callable pre-flight used by Edge Functions with the caller's JWT (auth.uid() inside).
create or replace function public.check_can_practise(p_check_limit boolean default true, p_require_policy boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.assert_can_practise((select auth.uid()), p_check_limit, p_require_policy); end $$;
revoke all on function public.check_can_practise(boolean, boolean) from public, anon;
grant execute on function public.check_can_practise(boolean, boolean) to authenticated;

-- ---------------------------------------------------------------- practice sessions
create or replace function public.start_practice_session(p_deck_id uuid, p_total_minutes int)
returns public.practice_sessions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_deck public.decks;
  v_attempt int; v_paid boolean; v_retake boolean; v_sid uuid := gen_random_uuid();
  v_weights int[]; v_sum numeric; v_secs int[]; v_policy uuid; v_row public.practice_sessions;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform private.assert_can_practise(v_uid, false, true);        -- limit handled below (attempt 1 is pre-paid by the upload)
  if p_total_minutes is null or p_total_minutes < 1 or p_total_minutes > 20 then raise exception 'invalid_minutes'; end if;

  select * into v_deck from public.decks where id = p_deck_id and owner_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if v_deck.status <> 'ready' then raise exception 'invalid_state'; end if;

  update public.practice_sessions set status = 'abandoned' where deck_id = p_deck_id and status = 'in_progress';

  select coalesce(max(attempt_number), 0) + 1 into v_attempt
    from public.practice_sessions where deck_id = p_deck_id and status <> 'abandoned';
  v_paid := exists (select 1 from public.practice_sessions where deck_id = p_deck_id and attempt_number = v_attempt and status = 'abandoned');
  v_retake := v_attempt >= 2 and not v_paid;

  select array_agg(time_weight order by slide_index), sum(time_weight) into v_weights, v_sum from public.slides where deck_id = p_deck_id;
  if v_weights is null or cardinality(v_weights) <> v_deck.page_count then raise exception 'invalid_state'; end if;
  select array_agg(round(p_total_minutes * 60.0 * w / v_sum)::int order by ord) into v_secs from unnest(v_weights) with ordinality as t(w, ord);

  select id into v_policy from public.policy_versions order by published_at desc, id desc limit 1;

  if v_retake then
    perform private.consume_daily_session(v_uid, 'retake', p_deck_id, v_sid);
  end if;

  insert into public.practice_sessions (id, deck_id, owner_id, attempt_number, total_minutes, suggested_seconds, status, policy_version_id)
  values (v_sid, p_deck_id, v_uid, v_attempt, p_total_minutes, v_secs, 'in_progress', v_policy)
  returning * into v_row;

  update public.profiles set last_active_at = now() where id = v_uid;   -- definer: bypasses column guard
  return v_row;
end $$;
revoke all on function public.start_practice_session(uuid, int) from public, anon;
grant execute on function public.start_practice_session(uuid, int) to authenticated;

create or replace function public.set_deck_pinned(p_deck_id uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); n int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform private.assert_can_practise(v_uid, false, false);
  update public.decks set pinned_at = case when p_pinned then now() else null end where id = p_deck_id and owner_id = v_uid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;
end $$;
revoke all on function public.set_deck_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_deck_pinned(uuid, boolean) to authenticated;

-- One rating per report; no edits in V1 (the design has a single "Send rating" then a thank-you state).
create or replace function public.rate_report(p_report_id uuid, p_stars int, p_comment text default null)
returns public.report_ratings language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_row public.report_ratings; v_comment text := nullif(btrim(p_comment), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform private.assert_can_practise(v_uid, false, true);
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'invalid_stars'; end if;
  if v_comment is not null and char_length(v_comment) > 500 then raise exception 'comment_too_long'; end if;
  if not exists (select 1 from public.reports r where r.id = p_report_id and r.owner_id = v_uid) then raise exception 'not_found'; end if;
  if exists (select 1 from public.report_ratings where report_id = p_report_id) then raise exception 'already_rated'; end if;
  insert into public.report_ratings (report_id, user_id, stars, comment) values (p_report_id, v_uid, p_stars, v_comment) returning * into v_row;
  return v_row;
end $$;
revoke all on function public.rate_report(uuid, int, text) from public, anon;
grant execute on function public.rate_report(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------- read helpers (SECURITY INVOKER => RLS applies)
create or replace function public.my_dashboard_stats() returns table (
  sessions_used_today int, daily_limit int, next_reset_at timestamptz,
  attempts_count int, average_score numeric, best_score int, total_practice_ms bigint, total_key_points_covered bigint
) language sql stable security invoker set search_path = '' as $$
  select
    (select count(*)::int from public.usage_events e where e.user_id = (select auth.uid()) and e.local_date = public.ist_date(now())),
    5,
    ((public.ist_date(now()) + 1)::timestamp at time zone 'Asia/Kolkata'),
    (select count(*)::int from public.reports r where r.owner_id = (select auth.uid())),
    (select round(avg(r.overall_score), 1) from public.reports r where r.owner_id = (select auth.uid())),
    (select max(r.overall_score) from public.reports r where r.owner_id = (select auth.uid())),
    (select coalesce(sum(r.total_duration_ms), 0)::bigint from public.reports r where r.owner_id = (select auth.uid())),
    (select coalesce(sum(r.key_points_covered), 0)::bigint from public.reports r where r.owner_id = (select auth.uid()))
$$;

create or replace function public.my_decks() returns table (
  deck_id uuid, title text, page_count int, pinned boolean, pinned_at timestamptz, created_at timestamptz,
  attempts_count int, latest_score int, latest_attempt_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  select d.id, d.title, d.page_count, d.pinned_at is not null, d.pinned_at, d.created_at,
         (select count(*)::int from public.reports r where r.deck_id = d.id),
         (select r.overall_score from public.reports r where r.deck_id = d.id order by r.attempt_number desc limit 1),
         (select max(r.created_at) from public.reports r where r.deck_id = d.id)
  from public.decks d
  where d.owner_id = (select auth.uid()) and d.status = 'ready'
  order by (d.pinned_at is not null) desc, d.pinned_at desc nulls last,
           coalesce((select max(r.created_at) from public.reports r where r.deck_id = d.id), d.created_at) desc
$$;

create or replace function public.my_deck_detail(p_deck_id uuid) returns table (
  report_id uuid, session_id uuid, attempt_number int, created_at timestamptz, overall_score int,
  coverage_score int, clarity_score int, timing_score int, filler_score int, overall_wpm numeric, delta_from_first int
) language sql stable security invoker set search_path = '' as $$
  select r.id, r.session_id, r.attempt_number, r.created_at, r.overall_score, r.coverage_score, r.clarity_score,
         r.timing_score, r.filler_score, r.overall_wpm, r.delta_from_first
  from public.reports r
  where r.deck_id = p_deck_id and r.owner_id = (select auth.uid())
  order by r.attempt_number
$$;

revoke all on function public.my_dashboard_stats(), public.my_decks(), public.my_deck_detail(uuid) from public, anon;
grant execute on function public.my_dashboard_stats(), public.my_decks(), public.my_deck_detail(uuid) to authenticated;

-- ---------------------------------------------------------------- realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.decks, public.practice_sessions;
  end if;
end $$;
