-- Minimal stand-in for the parts of a Supabase project our migrations rely on (plain-Postgres test harness).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create extension if not exists pgcrypto with schema extensions;
-- Superset of the columns seed.sql writes (real GoTrue has many more; they all have defaults).
create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text, role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id) on delete cascade, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
-- Supabase's default privileges (what the migrations must override):
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create publication supabase_realtime;
