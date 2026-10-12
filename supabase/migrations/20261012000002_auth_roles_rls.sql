-- Auth integration, owner allowlist, role helpers, privileges and RLS.

-- Default-deny for anything created later in `public` (Supabase otherwise grants ALL to anon/authenticated).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------- role helpers
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- owner allowlist + sign-up trigger
-- allowlist rows are inserted by the documented SQL step in docs/phase-1/owner-setup.md (never in a committed migration).
create or replace function private.sync_owner_role(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- NB: compare with lower(): with an empty search_path the citext '=' operator (schema `extensions`) is not resolvable
  -- and Postgres would silently fall back to case-sensitive text equality.
  if exists (select 1 from private.owner_allowlist a where lower(a.email::text) = lower(p_email)) then
    update public.profiles p set role = 'admin'
     where lower(p.email) = lower(p_email)
       and exists (select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null);
  end if;
end $$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := 'student';
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.email is not null and new.email_confirmed_at is not null
     and exists (select 1 from private.owner_allowlist a where lower(a.email::text) = lower(new.email)) then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, coalesce(new.email, ''),
          nullif(coalesce(v_meta->>'full_name', v_meta->>'name'), ''),
          nullif(coalesce(v_meta->>'avatar_url', v_meta->>'picture'), ''),
          v_role)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Promote automatically when an unconfirmed owner account later becomes confirmed.
create or replace function private.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and new.email is not null then
    perform private.sync_owner_role(new.email);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_confirmed();

-- ---------------------------------------------------------------- profile guard (defence in depth on top of column privileges)
create or replace function private.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id <> old.id or new.email is distinct from old.email or new.role <> old.role
       or new.is_blocked <> old.is_blocked or new.blocked_at is distinct from old.blocked_at
       or new.deletion_requested_at is distinct from old.deletion_requested_at
       or new.last_active_at is distinct from old.last_active_at
       or new.avatar_url is distinct from old.avatar_url
       or new.profile_completed_at is distinct from old.profile_completed_at then
      raise exception 'forbidden';
    end if;
  end if;
  if new.profile_completed_at is null and new.college is not null and new.year is not null and new.branch is not null then
    new.profile_completed_at := now();
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.profiles_guard();

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

grant select on public.policy_versions to anon, authenticated;
grant select on public.profiles, public.policy_acceptances, public.decks, public.slides, public.usage_events,
  public.practice_sessions, public.session_slide_results, public.reports, public.report_ratings to authenticated;
-- files: never expose bucket/object_key to clients
grant select (id, owner_id, deck_id, session_id, kind, slide_index, mime_type, size_bytes, expected_size_bytes, status,
              created_at, uploaded_at, deleted_at) on public.files to authenticated;
-- profiles: clients may only edit these columns
grant update (full_name, college, year, branch) on public.profiles to authenticated;

-- ---------------------------------------------------------------- RLS: enabled everywhere, default deny
alter table public.profiles enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acceptances enable row level security;
alter table public.decks enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.files enable row level security;
alter table public.slides enable row level security;
alter table public.usage_events enable row level security;
alter table public.session_slide_results enable row level security;
alter table public.reports enable row level security;
alter table public.report_ratings enable row level security;
alter table public.ai_key_slots enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.admin_actions enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and not is_blocked) with check (id = (select auth.uid()) and not is_blocked);

create policy policy_versions_read on public.policy_versions for select to anon, authenticated using (true);
create policy policy_acceptances_select_own on public.policy_acceptances for select to authenticated using (user_id = (select auth.uid()));

create policy decks_select_own on public.decks for select to authenticated using (owner_id = (select auth.uid()));
create policy sessions_select_own on public.practice_sessions for select to authenticated using (owner_id = (select auth.uid()));
create policy files_select_own on public.files for select to authenticated
  using (owner_id = (select auth.uid()) and kind <> 'audio_clip');
create policy slides_select_own on public.slides for select to authenticated
  using (exists (select 1 from public.decks d where d.id = slides.deck_id and d.owner_id = (select auth.uid())));
create policy usage_events_select_own on public.usage_events for select to authenticated using (user_id = (select auth.uid()));
create policy results_select_own on public.session_slide_results for select to authenticated
  using (exists (select 1 from public.practice_sessions s where s.id = session_slide_results.session_id and s.owner_id = (select auth.uid())));
create policy reports_select_own on public.reports for select to authenticated using (owner_id = (select auth.uid()));
create policy ratings_select_own on public.report_ratings for select to authenticated using (user_id = (select auth.uid()));
-- ai_key_slots, ai_usage_log, admin_actions: RLS on, no policies, no grants => only service role / SECURITY DEFINER admin RPCs.
