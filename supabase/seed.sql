-- LOCAL DEVELOPMENT SEED ONLY (applied by `supabase db reset`). Never run against a hosted project.
-- Passwords below are local-dev-only and documented in docs/phase-1/PHASE-1-HANDOFF.md section I. No real personal emails.
-- Content is a synthetic "ParkSense" sample (the design handoff's sample data was not available when this was written).

insert into private.owner_allowlist (email) values ('owner@mock2pitch.test') on conflict do nothing;

-- Auth users (email + password sign-in works in LOCAL Supabase only; hosted environments are Google-only).
with u(id, email, pw, name) as (values
  ('00000000-0000-4000-8000-000000000001', 'owner@mock2pitch.test', '_VG-3Tc2si0lSSvY', 'Owner Admin'),
  ('00000000-0000-4000-8000-0000000000a1', 'student.a@mock2pitch.test', 'HA6fRWOv-1Kfqmlr', 'Asha Rao'),
  ('00000000-0000-4000-8000-0000000000b1', 'student.b@mock2pitch.test', 'cbuApdcQC1p3LP60', 'Bharat Iyer'),
  ('00000000-0000-4000-8000-0000000000c1', 'student.blocked@mock2pitch.test', 'BZrnhaY4Qhra8XVf', 'Chetan Blocked'),
  ('00000000-0000-4000-8000-0000000000d1', 'student.new@mock2pitch.test', 'JIJWAwG6uQd7wCX_', 'Divya New')
)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, extensions.crypt(pw, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from u on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@mock2pitch.test' on conflict do nothing;

-- Profiles are created by the trigger; complete them.
update public.profiles set college = 'Demo Institute of Technology', year = '3rd year', branch = 'CSE' where email = 'student.a@mock2pitch.test';
update public.profiles set college = 'Sample College of Engineering', year = '4th year', branch = 'ECE' where email = 'student.b@mock2pitch.test';
update public.profiles set college = 'Blocked Test College', year = 'Other', branch = 'IT', is_blocked = true, blocked_at = now() where email = 'student.blocked@mock2pitch.test';
-- student.new has no profile details and no policy acceptance on purpose.

insert into public.policy_acceptances (user_id, policy_version_id)
select p.id, v.id from public.profiles p, (select id from public.policy_versions order by published_at desc limit 1) v
where p.email in ('student.a@mock2pitch.test','student.b@mock2pitch.test','student.blocked@mock2pitch.test') on conflict do nothing;

-- A ready 8-slide deck for student A.
insert into public.decks (id, owner_id, title, original_filename, page_count, status, pinned_at)
values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'ParkSense', 'ParkSense.pdf', 8, 'ready', now());
insert into public.slides (deck_id, slide_index, title, extracted_text, key_points, suggested_script, time_weight)
select '10000000-0000-4000-8000-0000000000a1', i, t, x, kp, sc, w from (values
  (0, 'Title: ParkSense', 'ParkSense - smart parking for campuses', array['State the project name and team', 'Say what problem it solves'], 'Good morning everyone. We are presenting ParkSense, a smart parking system for campuses.', 5),
  (1, 'The problem', 'Drivers circle for 12 minutes on average', array['Quote the 12-minute figure', 'Link it to late arrivals and pollution', 'Mention that nothing shows live availability'], 'On our campus drivers spend around twelve minutes searching for a space, which makes people late and adds pollution.', 15),
  (2, 'Our solution', 'Sensors + app show live free spaces', array['Ultrasonic sensor at each bay', 'Data goes to a cloud dashboard', 'Students see free bays in an app'], 'ParkSense places a low-cost sensor at every bay and shows live availability in a simple app.', 15),
  (3, 'Architecture', 'Sensor -> gateway -> cloud -> app', array['Name each of the four hops', 'Mention the update interval of 5 seconds', 'Say where data is stored'], 'Each sensor reports to a gateway, which forwards readings to the cloud, and the app reads from there every five seconds.', 20),
  (4, 'Prototype', 'Built with ESP32 and a React app', array['ESP32 plus ultrasonic sensor', 'React front end', 'Tested on 20 bays'], 'Our prototype uses an ESP32 with an ultrasonic sensor and a React app, tested on twenty bays.', 15),
  (5, 'Results', '94% detection accuracy, 4s latency', array['94 percent accuracy', 'Four second latency', 'Compare with manual counting'], 'We reached ninety-four percent detection accuracy with about four seconds of latency.', 15),
  (6, 'Cost & next steps', 'Rs 450 per bay; pilot planned', array['Rs 450 per bay', 'Pilot in two parking zones', 'Seek campus approval'], 'Each bay costs about four hundred and fifty rupees and we plan a pilot in two zones.', 10),
  (7, 'Thank you', 'Questions?', array['Thank the audience', 'Invite questions'], 'Thank you for listening. We would be happy to take your questions.', 5)
) as s(i, t, x, kp, sc, w);

-- Two completed attempts (62 then 74).
insert into public.practice_sessions (id, deck_id, owner_id, attempt_number, total_minutes, suggested_seconds, status, submitted_at, completed_at, created_at)
select ('20000000-0000-4000-8000-0000000000a' || n)::uuid, '10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', n, 5,
       (select array_agg(round(300.0 * time_weight / (select sum(time_weight) from public.slides where deck_id = '10000000-0000-4000-8000-0000000000a1'))::int order by slide_index) from public.slides where deck_id = '10000000-0000-4000-8000-0000000000a1'),
       'completed', now() - (3 - n) * interval '1 day', now() - (3 - n) * interval '1 day', now() - (3 - n) * interval '1 day'
from generate_series(1, 2) n;

insert into public.reports (id, session_id, owner_id, deck_id, attempt_number, overall_score, coverage_score, clarity_score, timing_score, filler_score,
                            overall_wpm, total_duration_ms, key_points_covered, key_points_total, filler_total, headline, top_fixes, did_well,
                            delta_from_first, first_attempt_score, scoring_version, models)
values
 ('30000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 1, 62, 56, 60, 70, 65,
  138.0, 330000, 14, 25, 9, 'Clear opening, but the middle slides skip key points.',
  array['Slide 4: you skipped 2 of 3 key points, including the 5-second update interval.','Slide 6: 4 filler words in 40 seconds; pause instead.','Slide 2: you ran 20 seconds over the suggested time.'],
  array['Slide 1: a confident, 15-second introduction.','Slide 3: all 3 key points covered in order.','Slide 8: closed with a clear invitation for questions.'],
  null, null, 'v1', '{"slide_reading":"seed","speech_to_text":"seed","report_generation":"seed"}'),
 ('30000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 2, 74, 70, 72, 80, 78,
  141.5, 305000, 18, 25, 6, 'Much tighter delivery; now add the missing results detail.',
  array['Slide 6: mention the comparison with manual counting.','Slide 4: name all four hops in the data flow.','Slide 5: say how many bays you tested (20).'],
  array['Slide 2: you quoted the 12-minute figure early.','Overall: timing is within 2% of your 5-minute target.','Slide 7: the cost per bay was clear and specific.'],
  12, 62, 'v1', '{"slide_reading":"seed","speech_to_text":"seed","report_generation":"seed"}');

insert into public.session_slide_results (session_id, slide_index, duration_ms, suggested_seconds, word_count, wpm, transcript, filler_count, fillers, key_points_covered, key_points_missed, off_topic_quotes)
select r.session_id, s.slide_index, 38000, 38, 88, 139.0, 'Seed transcript for slide ' || (s.slide_index + 1) || ' um with one filler.', 1, '[{"word":"um","count":1}]'::jsonb,
       array[0], array[1], '{}'::text[]
from public.reports r cross join public.slides s where s.deck_id = r.deck_id;

insert into public.report_ratings (report_id, user_id, stars, comment)
values ('30000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 4, 'The feedback was specific and the retake comparison helped.');

-- Student B: a ready deck, one completed report, a 5-star rating.
insert into public.decks (id, owner_id, title, original_filename, page_count, status)
values ('10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 'Capstone Review', 'Capstone Review.pdf', 2, 'ready');
insert into public.slides (deck_id, slide_index, title, extracted_text, key_points, suggested_script, time_weight)
values ('10000000-0000-4000-8000-0000000000b1', 0, 'Overview', 'Overview', array['State the goal'], 'Our goal is to ...', 50),
       ('10000000-0000-4000-8000-0000000000b1', 1, 'Outcome', 'Outcome', array['State the result'], 'We achieved ...', 50);
insert into public.practice_sessions (id, deck_id, owner_id, attempt_number, total_minutes, suggested_seconds, status, submitted_at, completed_at)
values ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 1, 4, '{120,120}', 'completed', now() - interval '2 days', now() - interval '2 days');
insert into public.reports (id, session_id, owner_id, deck_id, attempt_number, overall_score, coverage_score, clarity_score, timing_score, filler_score,
                            total_duration_ms, key_points_covered, key_points_total, filler_total, headline, top_fixes, did_well, scoring_version)
values ('30000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', 1, 83, 90, 80, 75, 80,
        235000, 2, 2, 3, 'Strong, concise delivery.', array['Slide 1: add one example.','Slide 2: slow down slightly.','Overall: add a closing sentence.'],
        array['Slide 1: clear goal.','Slide 2: clear result.','Overall: low filler use.'], 'v1');
insert into public.report_ratings (report_id, user_id, stars, comment) values ('30000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 5, null);

-- Daily-limit ledger for today (A: 1 upload + 1 retake; B: 1 upload).
insert into public.usage_events (user_id, kind, deck_id, local_date) values
 ('00000000-0000-4000-8000-0000000000a1', 'upload', '10000000-0000-4000-8000-0000000000a1', public.ist_date(now())),
 ('00000000-0000-4000-8000-0000000000a1', 'retake', '10000000-0000-4000-8000-0000000000a1', public.ist_date(now())),
 ('00000000-0000-4000-8000-0000000000b1', 'upload', '10000000-0000-4000-8000-0000000000b1', public.ist_date(now()));

update public.profiles set last_active_at = now() - interval '1 hour' where email = 'student.a@mock2pitch.test';
update public.profiles set last_active_at = now() - interval '2 days' where email = 'student.b@mock2pitch.test';
