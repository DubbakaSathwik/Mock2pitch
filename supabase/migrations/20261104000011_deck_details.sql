-- Presentation details collected after the slides are uploaded and before they are read (audience, goal, summary, time).
-- They shape the AI prompt (key points and script are written for this audience, goal and time limit). All columns are
-- optional so decks created before this migration, and old clients, keep working. Written only by the deck-process Edge
-- Function (service role); students can read their own decks through the existing select grant + RLS.
alter table public.decks
  add column if not exists audience text check (audience in ('student', 'teachers', 'jury', 'others')),
  add column if not exists audience_other text check (char_length(audience_other) between 1 and 80),
  add column if not exists goal text check (char_length(goal) between 1 and 300),
  add column if not exists abstract text check (char_length(abstract) between 1 and 600),
  add column if not exists target_minutes integer check (target_minutes between 1 and 20);

-- "Others" needs the free-text description; the other audiences must not carry one. (Guarded so the file can be re-run, e.g. by `db push`
-- after the SQL was applied by hand.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'decks_audience_other_matches' and conrelid = 'public.decks'::regclass) then
    alter table public.decks
      add constraint decks_audience_other_matches check (
        (coalesce(audience, '') = 'others' and audience_other is not null) or (coalesce(audience, '') <> 'others' and audience_other is null)
      );
  end if;
end $$;

comment on column public.decks.audience is 'Who the student presents to: student | teachers | jury | others';
comment on column public.decks.audience_other is 'Free-text audience when audience = others';
comment on column public.decks.goal is 'Why / what for (optional, student supplied, <= 300 chars)';
comment on column public.decks.abstract is 'Short summary of the presentation (optional, student supplied, <= 50 words)';
comment on column public.decks.target_minutes is 'Total time limit chosen on the details form (1-20); seeds the Time step';
