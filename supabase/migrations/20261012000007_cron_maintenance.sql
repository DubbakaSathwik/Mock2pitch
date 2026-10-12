-- Schedule maintenance-sweep every 15 minutes via pg_cron + pg_net, reading the target URL and secret from Supabase Vault.
-- Skipped silently where the extensions are unavailable (e.g. plain Postgres test harness). One-time setup: docs/phase-1/owner-setup.md.
create or replace function private.invoke_maintenance_sweep() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'internal_function_secret';
  if v_url is null or v_secret is null then
    raise notice 'maintenance-sweep not configured (vault secrets missing)';
    return;
  end if;
  perform net.http_post(url := rtrim(v_url, '/') || '/maintenance-sweep',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000);
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_available_extensions where name = 'supabase_vault') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    create extension if not exists supabase_vault;
    perform cron.schedule('maintenance-sweep', '*/15 * * * *', 'select private.invoke_maintenance_sweep()');
  end if;
end $$;
