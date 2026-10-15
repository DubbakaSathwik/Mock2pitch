# Phase 4 — owner decisions

Status legend: ⏳ asked, awaiting answer (default applies if none) · ✅ answered · ⚠ blocker

| # | Question | Default applied if no answer | Answer | Date |
|---|---|---|---|---|
| Q1 | Phase 2 additions (Delete account, "Your account is paused", AI failure/retry cards, PowerPoint "Save as PDF" hint, "Use Chrome" note, 10:00 recording cap) | Keep as built | ⏳ | |
| Q2 | Admin AI usage = 3 cards × 3 keys; deck detail compares first vs latest; admin sees deck titles (now disclosed in the privacy draft) | Keep as built | ⏳ | |
| Q3 | Final Terms & Privacy v1.1; remove test version `v1.0.1`? | ⚠ **Blocker.** Draft prepared: `terms-privacy-v1.1-draft.md`. `v1.0.1` deleted only with explicit OK | ⏳ | |
| Q4 | Filler wording (Parakeet drops "um/uh") | One muted line on the Filler words card + accordion: "We count words like 'like', 'basically' and 'you know'. Short sounds like 'um' may not be picked up." | ⏳ | |
| Q5 | Scoring constants (timing ±5 % → 0 at ±50 %; 15 points per filler/min) | Keep `scoring_version v1` | ⏳ | |
| Q6 | Second (fallback) NVIDIA key for report analysis (and others) | Launch risk if not provided (report model 503 on 3/8 calls) | ⏳ | |
| Q7 | JWT signing keys | Stay on legacy HS256; migration is post-launch | ⏳ | |
| Q8 | Netlify site name / custom domain | `<site>.netlify.app`, no custom domain | ⏳ | |
| Q9 | Backups: Supabase plan; scheduled `pg_dump`? | Document plan limits; propose, do not build | ⏳ | |
| Q10 | Merge PR #13 to `main` now? | Ask; release work stays on the branch until merged | ⏳ | |

## Facts established during inspection that bear on the decisions
* No real users exist yet (0 `auth.users`), so there is no data risk in the cut-over order.
* No Mock2Pitch Netlify site exists; the only Netlify site on the account (`boutiqoo`) belongs to something else and is out of scope.
* The v1.0 Privacy text is **inaccurate** about owner visibility (deck titles, attempt scores/dates and rating comments are visible to the owner) — corrected in the v1.1 draft.
