-- Phase 3: "Before User Created" Auth Hook. Production sign-up is Google-only; this makes that true even if the Email provider is switched on
-- (needed so automated tests can sign in pre-provisioned @mock2pitch.test users with a password). Enable it once in
-- Supabase -> Authentication -> Hooks -> Before User Created -> Postgres function -> public.hook_before_user_created.
-- Users created directly in the database (test provisioning) do not go through the hook.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_provider text := coalesce(event #>> '{user,app_metadata,provider}', '');
begin
  if v_provider = 'google' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Sign-up is only available with Google.'));
end $$;

-- Only the Auth service may run it (it is not an API).
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
do $$ begin
  if exists (select from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;
