# Supabase adapter — Phase 3

Phase 2 ships only the mock adapter (`../mock`). Phase 3 implements `DataPort` (`../types.ts`) here against the hosted project:
direct reads via supabase-js (RLS applies), RPCs, Edge Functions (`POST /functions/v1/<name>` with the user's JWT) and Realtime
`postgres_changes`. The exact method → contract mapping is the table in `docs/phase-2/PHASE-2-HANDOFF.md` §N.

Nothing in this folder may be imported in Phase 2 (no reads, no writes, no auth against the hosted project).
