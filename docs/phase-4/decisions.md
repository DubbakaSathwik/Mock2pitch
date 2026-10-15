# Phase 4 — owner decisions

Status legend: ⏳ asked, awaiting answer (default applies if none) · ✅ answered · ⚠ blocker

| # | Question | Default applied if no answer | Answer | Date |
|---|---|---|---|---|
| Q1 | Phase 2 additions (Delete account, "Your account is paused", AI failure/retry cards, PowerPoint "Save as PDF" hint, "Use Chrome" note, 10:00 recording cap) | Keep as built | ✅ Approved, keep as built. | 2026-10-15 |
| Q2 | Admin AI usage = 3 cards × 3 keys; deck detail compares first vs latest; admin sees deck titles (now disclosed in the privacy draft) | Keep as built | ✅ Approved, keep as built (3×3 AI usage, first vs latest, admin sees deck titles — disclosed in v1.1). | 2026-10-15 |
| Q3 | Final Terms & Privacy v1.1; remove test version `v1.0.1`? | ⚠ **Blocker.** Draft prepared: `terms-privacy-v1.1-draft.md`. `v1.0.1` deleted only with explicit OK | ✅ Owner will review the v1.1 draft. Contact `dubbakasathwik@gmail.com`; age rule kept (18+, or with parent/guardian permission); region India, governing law India. **Delete `v1.0.1`: approved** (the Supabase tool holds DELETEs for confirmation, so it has to be run in the SQL editor — pending). **Publish v1.1 only after the owner confirms the final text.** | 2026-10-15 |
| Q4 | Filler wording (Parakeet drops "um/uh") | One muted line on the Filler words card + accordion: "We count words like 'like', 'basically' and 'you know'. Short sounds like 'um' may not be picked up." | ✅ Yes — implemented (`FILLER_NOTE` in `features/reports/Report.tsx`, shown on the Filler words card and in each slide's accordion; asserted in `e2e/journey-2-practice.spec.ts`). | 2026-10-15 |
| Q5 | Scoring constants (timing ±5 % → 0 at ±50 %; 15 points per filler/min) | Keep `scoring_version v1` | ✅ Keep `scoring_version v1`. | 2026-10-15 |
| Q6 | Second (fallback) NVIDIA key for report analysis (and others) | Launch risk if not provided (report model 503 on 3/8 calls) | ✅ No fallback key yet → **listed as a launch risk**. | 2026-10-15 |
| Q7 | JWT signing keys | Stay on legacy HS256; migration is post-launch | ✅ Stay on HS256 for launch; JWT key migration added to the post-launch backlog. | 2026-10-15 |
| Q8 | Netlify site name / custom domain | `<site>.netlify.app`, no custom domain | ✅ Netlify deploy happens **after everything is tested locally**; the owner creates the site and sends the URL. | 2026-10-15 |
| Q9 | Backups: Supabase plan; scheduled `pg_dump`? | Document plan limits; propose, do not build | ✅ Supabase **free plan**, must not cost anything → no paid backup; free-plan limits (no point-in-time recovery, 7-day-inactivity pausing) documented as launch risks; a no-cost logical-backup option to be proposed only. | 2026-10-15 |
| Q10 | Merge PR #13 to `main` now? | Ask; release work stays on the branch until merged | ✅ Merge PR #13 now; `main` = production. **Merged 2026-10-15 (merge commit `50738ac`)**; the function-deploy workflow re-deployed the same code from `main`. | 2026-10-15 |

## Facts established during inspection that bear on the decisions
* No real users exist yet (0 `auth.users`), so there is no data risk in the cut-over order.
* No Mock2Pitch Netlify site exists; the only Netlify site on the account (`boutiqoo`) belongs to something else and is out of scope.
* The v1.0 Privacy text is **inaccurate** about owner visibility (deck titles, attempt scores/dates and rating comments are visible to the owner) — corrected in the v1.1 draft.
