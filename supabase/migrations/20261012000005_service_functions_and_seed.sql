-- Functions called only by Edge Functions (service role) + seed data required in every environment.

-- Atomic: daily-limit consumption + deck state + slide-image file rows (so a failure never charges without images).
create or replace function public.svc_complete_deck_upload(p_deck_id uuid, p_page_count int, p_pdf_size bigint, p_images jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_deck public.decks; img jsonb;
begin
  select * into v_deck from public.decks where id = p_deck_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_deck.status <> 'awaiting_upload' then raise exception 'invalid_state'; end if;
  perform private.assert_can_practise(v_deck.owner_id, false, false);
  perform private.consume_daily_session(v_deck.owner_id, 'upload', p_deck_id, null);
  update public.files set status = 'uploaded', size_bytes = p_pdf_size, uploaded_at = now()
   where deck_id = p_deck_id and kind = 'deck_pdf' and status = 'pending';
  for img in select * from jsonb_array_elements(p_images) loop
    insert into public.files (owner_id, deck_id, kind, slide_index, bucket, object_key, mime_type, expected_size_bytes, status)
    values (v_deck.owner_id, p_deck_id, 'slide_image', (img->>'slide_index')::int, img->>'bucket', img->>'object_key', 'image/jpeg',
            (img->>'expected_size_bytes')::bigint, 'pending');
  end loop;
  update public.decks set status = 'awaiting_images', page_count = p_page_count, processing_stage = 'Waiting for slide images',
         error_code = null where id = p_deck_id;
  update public.profiles set last_active_at = now() where id = v_deck.owner_id;
end $$;

-- Atomic report write + session completion.
create or replace function public.svc_finalize_report(p_session_id uuid, p_report jsonb, p_results jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.practice_sessions; v_id uuid; r jsonb;
begin
  select * into s from public.practice_sessions where id = p_session_id for update;
  if not found then raise exception 'not_found'; end if;
  if s.status not in ('generating_report','transcribing') then raise exception 'invalid_state'; end if;
  for r in select * from jsonb_array_elements(p_results) loop
    insert into public.session_slide_results (session_id, slide_index, duration_ms, suggested_seconds, word_count, wpm, transcript,
        word_timings, filler_count, fillers, key_points_covered, key_points_missed, off_topic_quotes, slide_feedback)
    values (p_session_id, (r->>'slide_index')::int, coalesce((r->>'duration_ms')::int, 0), coalesce((r->>'suggested_seconds')::int, 0),
        (r->>'word_count')::int, (r->>'wpm')::numeric, r->>'transcript', r->'word_timings', (r->>'filler_count')::int, r->'fillers',
        coalesce(array(select jsonb_array_elements_text(r->'key_points_covered'))::int[], '{}'),
        coalesce(array(select jsonb_array_elements_text(r->'key_points_missed'))::int[], '{}'),
        coalesce(array(select jsonb_array_elements_text(r->'off_topic_quotes')), '{}'), r->>'slide_feedback')
    on conflict (session_id, slide_index) do update set
        duration_ms = excluded.duration_ms, suggested_seconds = excluded.suggested_seconds, word_count = excluded.word_count,
        wpm = excluded.wpm, transcript = excluded.transcript, word_timings = excluded.word_timings, filler_count = excluded.filler_count,
        fillers = excluded.fillers, key_points_covered = excluded.key_points_covered, key_points_missed = excluded.key_points_missed,
        off_topic_quotes = excluded.off_topic_quotes, slide_feedback = excluded.slide_feedback;
  end loop;
  insert into public.reports (session_id, owner_id, deck_id, attempt_number, overall_score, coverage_score, clarity_score, timing_score,
      filler_score, overall_wpm, total_duration_ms, key_points_covered, key_points_total, filler_total, headline, top_fixes, did_well,
      delta_from_first, first_attempt_score, scoring_version, models)
  values (p_session_id, s.owner_id, s.deck_id, s.attempt_number, (p_report->>'overall_score')::int, (p_report->>'coverage_score')::int,
      (p_report->>'clarity_score')::int, (p_report->>'timing_score')::int, (p_report->>'filler_score')::int,
      (p_report->>'overall_wpm')::numeric, (p_report->>'total_duration_ms')::int, (p_report->>'key_points_covered')::int,
      (p_report->>'key_points_total')::int, (p_report->>'filler_total')::int, p_report->>'headline',
      array(select jsonb_array_elements_text(p_report->'top_fixes')), array(select jsonb_array_elements_text(p_report->'did_well')),
      (p_report->>'delta_from_first')::int, (p_report->>'first_attempt_score')::int, p_report->>'scoring_version', p_report->'models')
  on conflict (session_id) do update set headline = excluded.headline  -- idempotent re-run keeps the first report
  returning id into v_id;
  update public.practice_sessions set status = 'completed', completed_at = now(), analysis_stage = null, error_code = null where id = p_session_id;
  return v_id;
end $$;

-- Router state in one round trip.
create or replace function public.svc_ai_slot_states(p_purpose text)
returns table (id uuid, slot text, cooldown_until timestamptz, credit_limit int, used_credits int, requests_last_60s int)
language sql stable security definer set search_path = '' as $$
  select k.id, k.slot, k.cooldown_until, k.credit_limit,
    (select count(*)::int from public.ai_usage_log l where l.key_slot_id = k.id and l.outcome in ('success','invalid_output') and l.created_at >= k.credit_period_start),
    (select count(*)::int from public.ai_usage_log l where l.key_slot_id = k.id and l.created_at > now() - interval '60 seconds')
  from public.ai_key_slots k where k.purpose = p_purpose
$$;

create or replace function public.svc_touch_active(p_uid uuid) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now() where id = p_uid
$$;

revoke all on function public.svc_complete_deck_upload(uuid, int, bigint, jsonb), public.svc_finalize_report(uuid, jsonb, jsonb),
  public.svc_ai_slot_states(text), public.svc_touch_active(uuid) from public, anon, authenticated;
grant execute on function public.svc_complete_deck_upload(uuid, int, bigint, jsonb), public.svc_finalize_report(uuid, jsonb, jsonb),
  public.svc_ai_slot_states(text), public.svc_touch_active(uuid) to service_role;
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------- seed: 9 key-slot rows (metadata only)
insert into public.ai_key_slots (purpose, slot)
select p, s from unnest(array['slide_reading','speech_to_text','report_generation']) p, unnest(array['primary','fallback_1','fallback_2']) s;
