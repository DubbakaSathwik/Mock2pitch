# Monitoring (what to watch, with ready-to-run SQL)

Run in Supabase → SQL editor (read-only). Nothing here needs an external service; an external uptime check is optional and only with owner approval.

## Daily (2 minutes)
```sql
-- 1. AI failures by purpose/slot/outcome, last 24 h (a few 503s are normal; a steady stream is not)
select l.purpose, s.slot, l.outcome, l.http_status, count(*) n
from ai_usage_log l left join ai_key_slots s on s.id = l.key_slot_id
where l.created_at > now() - interval '24 hours' and l.outcome <> 'success'
group by 1,2,3,4 order by n desc;

-- 2. Success rate per purpose, last 24 h
select purpose, count(*) filter (where outcome = 'success') ok, count(*) total,
       round(100.0 * count(*) filter (where outcome = 'success') / nullif(count(*),0)) pct_ok
from ai_usage_log where created_at > now() - interval '24 hours' group by 1;

-- 3. Cron health
select status, count(*), max(start_time) last_run from cron.job_run_details where start_time > now() - interval '24 hours' group by 1;

-- 4. Audio older than 24 h must be 0
select count(*) from files where kind = 'audio_clip' and status in ('pending','uploaded') and created_at < now() - interval '24 hours';
```

## Weekly
```sql
-- sessions per day (IST), last 14 days
select local_date, count(*) from usage_events where local_date > current_date - 14 group by 1 order by 1;

-- p50 / p95 time from submit to report (completed sessions, last 7 days)
select percentile_cont(0.5) within group (order by extract(epoch from (r.created_at - s.submitted_at))) p50_s,
       percentile_cont(0.95) within group (order by extract(epoch from (r.created_at - s.submitted_at))) p95_s,
       count(*) n
from practice_sessions s join reports r on r.session_id = s.id
where r.created_at > now() - interval '7 days' and s.submitted_at is not null;

-- failed sessions and why, last 7 days
select error_code, count(*) from practice_sessions where status = 'failed' and updated_at > now() - interval '7 days' group by 1 order by 2 desc;

-- orphan files: pending > 1 h (the sweeper should have failed them)
select count(*) from files where status = 'pending' and created_at < now() - interval '1 hour';

-- credit use per key slot vs its limit (also visible in Admin → AI usage)
select purpose, slot, used_credits, credit_limit from (
  select s.purpose, s.slot, s.credit_limit, coalesce(count(l.*) filter (where l.outcome in ('success','invalid_output') and l.created_at >= s.credit_period_start),0) used_credits
  from ai_key_slots s left join ai_usage_log l on l.key_slot_id = s.id group by s.purpose, s.slot, s.credit_limit) q order by purpose, slot;
```
Advisors: Supabase → Advisors (security + performance) monthly and after every migration; expected findings are listed in `docs/phase-4/security-audit.md`.

## Limits to keep in mind (free tiers)
Supabase free: project pauses after 7 days without activity (restore from the dashboard; sign in to the app weekly or ask the owner to), no point-in-time recovery, 500 MB database, 50 000 monthly active users, 500 000 function invocations/month. Netlify free: 100 GB bandwidth, 300 build minutes. R2 free: 10 GB storage, 1M Class A / 10M Class B operations per month. NVIDIA trial credits/rate limits are the binding constraint for a public launch — see `docs/phase-4/PHASE-4-HANDOFF.md` (capacity plan).
