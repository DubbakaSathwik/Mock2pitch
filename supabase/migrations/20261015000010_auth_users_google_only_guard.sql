-- Phase 3: defence in depth for "Google sign-in only". Whatever the dashboard's Email provider / Hooks settings are, a user row created by the
-- Auth service (role supabase_auth_admin: public sign-ups, magic links, admin-API calls) must come from Google. Exceptions:
--   * `@mock2pitch.test` addresses (the operator self-test and integration-test users; public sign-up cannot use that reserved domain),
--   * rows inserted directly in SQL by an operator (current_user is not supabase_auth_admin), which is how test users are provisioned.
create or replace function private.reject_non_google_signup() returns trigger
-- SECURITY INVOKER on purpose: current_user must be the role that runs the INSERT (supabase_auth_admin for the Auth service).
language plpgsql set search_path = '' as $$
declare v_providers jsonb := coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb);
begin
  if current_user = 'supabase_auth_admin'
     and coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     and not (v_providers ? 'google')
     and coalesce(new.email, '') not like '%@mock2pitch.test' then
    raise exception 'signup_not_allowed' using hint = 'Sign-up is only available with Google.';
  end if;
  return new;
end $$;
revoke all on function private.reject_non_google_signup() from public, anon, authenticated;

drop trigger if exists a_reject_non_google_signup on auth.users;
create trigger a_reject_non_google_signup before insert on auth.users
  for each row execute function private.reject_non_google_signup();
