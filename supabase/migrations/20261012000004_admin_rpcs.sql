-- Admin-only RPCs. They return summary fields only (no slide content, images, scripts, transcripts or feedback text).
-- Billable AI outcomes (count as credits used): success, invalid_output.

create or replace function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if not private.is_admin() then raise exception 'forbidden'; end if;
end $$;

create or replace function public.admin_overview() returns table (
  total_students int, sessions_last_14_days int, sessions_all_time int,
  average_rating numeric, ratings_count int, ai_credits_used bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select
    (select count(*)::int from public.profiles where role = 'student'),
    (select count(*)::int from public.practice_sessions s where s.submitted_at is not null and public.ist_date(s.submitted_at) > public.ist_date(now()) - 14),
    (select count(*)::int from public.practice_sessions s where s.submitted_at is not null),
    (select round(avg(stars), 2) from public.report_ratings),
    (select count(*)::int from public.report_ratings),
    (select count(*) from public.ai_usage_log l join public.ai_key_slots k on k.id = l.key_slot_id
       where l.outcome in ('success','invalid_output') and l.created_at >= k.credit_period_start);
end $$;

create or replace function public.admin_sessions_per_day(p_days int default 14) returns table (day date, count int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  p_days := least(greatest(coalesce(p_days, 14), 1), 365);
  return query
    select d::date, coalesce(c.n, 0)::int
    from generate_series(public.ist_date(now()) - (p_days - 1), public.ist_date(now()), interval '1 day') d
    left join (select public.ist_date(s.submitted_at) as dd, count(*) n from public.practice_sessions s
                where s.submitted_at is not null group by 1) c on c.dd = d::date
    order by 1;
end $$;

create or replace function public.admin_list_students(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  user_id uuid, full_name text, email text, college text, year text, branch text, avatar_url text,
  attempts int, last_active_at timestamptz, average_score numeric, is_blocked boolean, total_count bigint
) language plpgsql stable security definer set search_path = '' as $$
declare v_q text;
begin
  perform private.require_admin();
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  v_q := case when nullif(btrim(p_search), '') is null then null
              else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  return query
    select p.id, p.full_name, p.email, p.college, p.year, p.branch, p.avatar_url,
           coalesce(r.n, 0)::int, p.last_active_at, r.avg_score, p.is_blocked, count(*) over ()
    from public.profiles p
    left join (select owner_id, count(*) n, round(avg(overall_score), 1) avg_score from public.reports group by owner_id) r on r.owner_id = p.id
    where p.role = 'student'
      and (v_q is null or p.full_name ilike v_q or p.email ilike v_q or p.college ilike v_q)
    order by p.last_active_at desc nulls last, p.created_at desc
    limit p_limit offset p_offset;
end $$;

create or replace function public.admin_student_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'profile', jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'email', p.email, 'college', p.college, 'year', p.year,
               'branch', p.branch, 'avatar_url', p.avatar_url, 'is_blocked', p.is_blocked, 'last_active_at', p.last_active_at, 'created_at', p.created_at),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('report_id', r.id, 'deck_title', d.title, 'attempt_number', r.attempt_number,
                 'date', r.created_at, 'overall_score', r.overall_score) order by r.created_at desc)
                 from public.reports r join public.decks d on d.id = r.deck_id where r.owner_id = p.id), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('deck_title', d.title, 'stars', rr.stars, 'comment', rr.comment, 'date', rr.created_at)
                 order by rr.created_at desc)
                 from public.report_ratings rr join public.reports r on r.id = rr.report_id join public.decks d on d.id = r.deck_id
                 where rr.user_id = p.id), '[]'::jsonb))
  into v from public.profiles p where p.id = p_user_id and p.role = 'student';
  if v is null then raise exception 'not_found'; end if;
  return v;
end $$;

create or replace function public.admin_set_blocked(p_user_id uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.require_admin();
  update public.profiles set is_blocked = p_blocked, blocked_at = case when p_blocked then now() else null end
   where id = p_user_id and role = 'student';
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then raise exception 'cannot_block_admin'; end if;
    raise exception 'not_found';
  end if;
  insert into public.admin_actions (admin_id, action, target_user_id, detail)
  values ((select auth.uid()), case when p_blocked then 'block' else 'unblock' end, p_user_id, null);
end $$;

create or replace function public.admin_ratings(p_stars int default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'average', (select round(avg(stars), 2) from public.report_ratings),
    'count', (select count(*) from public.report_ratings),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('student_name', coalesce(p.full_name, p.email), 'user_id', p.id, 'deck_title', d.title,
              'stars', rr.stars, 'comment', rr.comment, 'date', rr.created_at) order by rr.created_at desc)
              from public.report_ratings rr join public.profiles p on p.id = rr.user_id
              join public.reports r on r.id = rr.report_id join public.decks d on d.id = r.deck_id
              where p_stars is null or rr.stars = p_stars), '[]'::jsonb))
  into v;
  return v;
end $$;

create or replace function public.admin_ai_usage(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform private.require_admin();
  p_days := least(greatest(coalesce(p_days, 7), 1), 90);
  select jsonb_agg(jsonb_build_object(
    'purpose', pp.purpose,
    'slots', (select jsonb_agg(jsonb_build_object(
        'slot_id', k.id, 'slot', k.slot, 'credit_limit', k.credit_limit, 'used', u.used,
        'remaining', greatest(k.credit_limit - u.used, 0),
        'percent_used', case when k.credit_limit = 0 then 100 else round(100.0 * u.used / k.credit_limit, 1) end,
        'running_low', (k.credit_limit = 0 or 100.0 * u.used / k.credit_limit > 75),
        'cooldown_until', k.cooldown_until, 'last_error_code', k.last_error_code)
        order by case k.slot when 'primary' then 1 when 'fallback_1' then 2 else 3 end)
      from public.ai_key_slots k
      cross join lateral (select count(*)::int used from public.ai_usage_log l
         where l.key_slot_id = k.id and l.outcome in ('success','invalid_output') and l.created_at >= k.credit_period_start) u
      where k.purpose = pp.purpose),
    'per_day', (select jsonb_agg(jsonb_build_object('date', d::date, 'count', coalesce(c.n, 0)) order by d)
      from generate_series(public.ist_date(now()) - (p_days - 1), public.ist_date(now()), interval '1 day') d
      left join (select public.ist_date(l.created_at) dd, count(*) n from public.ai_usage_log l
                  where l.purpose = pp.purpose and l.outcome in ('success','invalid_output') group by 1) c on c.dd = d::date)
  ) order by case pp.purpose when 'slide_reading' then 1 when 'speech_to_text' then 2 else 3 end)
  into v
  from (select distinct purpose from public.ai_key_slots) pp;
  return jsonb_build_object('purposes', coalesce(v, '[]'::jsonb));
end $$;

create or replace function public.admin_set_credit_limit(p_slot_id uuid, p_limit int, p_reset_period boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.require_admin();
  if p_limit is null or p_limit < 0 then raise exception 'invalid_limit'; end if;
  update public.ai_key_slots set credit_limit = p_limit,
         credit_period_start = case when p_reset_period then now() else credit_period_start end
   where id = p_slot_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_found'; end if;
  insert into public.admin_actions (admin_id, action, detail)
  values ((select auth.uid()), 'set_credit_limit', jsonb_build_object('slot_id', p_slot_id, 'limit', p_limit, 'reset', p_reset_period));
end $$;

-- Version labels look like v1.0, v1.1, v2.0 and must be strictly increasing.
create or replace function private.version_key(p_label text) returns int[]
language sql immutable set search_path = '' as $$
  select string_to_array(substring(p_label from '^v(\d+(?:\.\d+)*)$'), '.')::int[]
$$;

create or replace function public.admin_publish_policy(p_version_label text, p_terms_body text, p_privacy_body text, p_note text default null)
returns public.policy_versions language plpgsql security definer set search_path = '' as $$
declare v_cur public.policy_versions; v_row public.policy_versions;
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('publish_policy'));
  if p_version_label is null or private.version_key(p_version_label) is null then raise exception 'invalid_label'; end if;
  if p_terms_body is null or char_length(p_terms_body) not between 1 and 50000
     or p_privacy_body is null or char_length(p_privacy_body) not between 1 and 50000 then raise exception 'invalid_body'; end if;
  select * into v_cur from public.policy_versions order by published_at desc, id desc limit 1;
  if found and private.version_key(v_cur.version_label) is not null
     and private.version_key(p_version_label) <= private.version_key(v_cur.version_label) then raise exception 'label_not_increasing'; end if;
  insert into public.policy_versions (version_label, terms_body, privacy_body, note, published_by)
  values (p_version_label, p_terms_body, p_privacy_body, nullif(btrim(p_note), ''), (select auth.uid()))
  returning * into v_row;
  insert into public.admin_actions (admin_id, action, detail)
  values ((select auth.uid()), 'publish_policy', jsonb_build_object('version', p_version_label));
  return v_row;
end $$;

create or replace function public.admin_policy_versions() returns table (
  id uuid, version_label text, note text, published_at timestamptz, published_by uuid, is_live boolean, terms_body text, privacy_body text
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query select v.id, v.version_label, v.note, v.published_at, v.published_by,
    (v.id = (select l.id from public.policy_versions l order by l.published_at desc, l.id desc limit 1)),
    v.terms_body, v.privacy_body
  from public.policy_versions v order by v.published_at desc, v.id desc;
end $$;

revoke all on function public.admin_overview(), public.admin_sessions_per_day(int), public.admin_list_students(text, int, int),
  public.admin_student_detail(uuid), public.admin_set_blocked(uuid, boolean), public.admin_ratings(int), public.admin_ai_usage(int),
  public.admin_set_credit_limit(uuid, int, boolean), public.admin_publish_policy(text, text, text, text), public.admin_policy_versions()
  from public, anon;
grant execute on function public.admin_overview(), public.admin_sessions_per_day(int), public.admin_list_students(text, int, int),
  public.admin_student_detail(uuid), public.admin_set_blocked(uuid, boolean), public.admin_ratings(int), public.admin_ai_usage(int),
  public.admin_set_credit_limit(uuid, int, boolean), public.admin_publish_policy(text, text, text, text), public.admin_policy_versions()
  to authenticated;
