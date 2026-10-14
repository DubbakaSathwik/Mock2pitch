-- Account deletion bookkeeping (service role only). The prefix to clean in R2 is recorded BEFORE the auth user is removed.
create or replace function public.svc_begin_account_deletion(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_uid) then raise exception 'not_found'; end if;
  update public.profiles set deletion_requested_at = coalesce(deletion_requested_at, now()) where id = p_uid;
  insert into private.pending_deletions (user_id, prefix) values (p_uid, 'users/' || p_uid::text || '/')
  on conflict (user_id) do nothing;
end $$;

create or replace function public.svc_finish_account_deletion(p_uid uuid) returns void
language sql security definer set search_path = '' as $$
  update private.pending_deletions set completed_at = now() where user_id = p_uid
$$;

create or replace function public.svc_pending_deletions() returns table (user_id uuid, prefix text)
language sql stable security definer set search_path = '' as $$
  select user_id, prefix from private.pending_deletions where completed_at is null order by requested_at limit 50
$$;

revoke all on function public.svc_begin_account_deletion(uuid), public.svc_finish_account_deletion(uuid), public.svc_pending_deletions()
  from public, anon, authenticated;
grant execute on function public.svc_begin_account_deletion(uuid), public.svc_finish_account_deletion(uuid), public.svc_pending_deletions() to service_role;
