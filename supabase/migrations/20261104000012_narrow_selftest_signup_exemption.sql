-- Security hardening of the "Google sign-in only" guard (private.reject_non_google_signup, migration 20261015000010).
-- That guard exempted EVERY `@mock2pitch.test` address created by the Auth service. The only legitimate caller is the operator self-test
-- (Edge Function ops-selftest), which creates `selftest-<epoch ms>@mock2pitch.test` through the Auth admin API with email_confirm = true.
-- Everything else (integration-test users) is provisioned by operator SQL, which this trigger never inspects.
-- The exemption now requires BOTH that exact address shape AND an already-confirmed email, so a public sign-up for an arbitrary
-- `x@mock2pitch.test` address (or an unconfirmed one) is rejected like any other non-Google sign-up.
-- CREATE OR REPLACE keeps the function's existing privileges; the trigger itself is unchanged.
create or replace function private.reject_non_google_signup() returns trigger
-- SECURITY INVOKER on purpose: current_user must be the role that runs the INSERT (supabase_auth_admin for the Auth service).
language plpgsql set search_path = '' as $$
declare v_providers jsonb := coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb);
begin
  if current_user = 'supabase_auth_admin'
     and coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     and not (v_providers ? 'google')
     and not (coalesce(new.email, '') ~ '^selftest-[0-9]+@mock2pitch\.test$' and new.email_confirmed_at is not null) then
    raise exception 'signup_not_allowed' using hint = 'Sign-up is only available with Google.';
  end if;
  return new;
end $$;
revoke all on function private.reject_non_google_signup() from public, anon, authenticated;
