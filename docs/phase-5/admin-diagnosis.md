# Admin → Diagnosis

Owner-only page (`/admin/diagnosis`, backed by the `admin-diagnose` Edge Function) to test every external service with a preset or your own input.

| Service | Preset test | Own input |
|---|---|---|
| Slide reading · Gemini | the real slide-reading prompt + a sample slide image; checks valid JSON, slide 1 present, key points and script | any prompt, optional sample image, optional "answer must contain" |
| Report writing · NVIDIA | asks for exactly `{"ok":true}` | any prompt, optional "answer must contain" |
| Speech to text · NVIDIA | a 6-second synthetic clip; transcript must share ≥ 60% of the known words | (not applicable: audio input) |
| File storage · Cloudflare R2 | write, read back, delete one small file | – |
| Database · Supabase | read query; 9 key slots present (migrations applied) | – |

For the AI services you can pick which key slot to test (Primary / Fallback 1 / Fallback 2) and try a candidate **model** without changing any secret.

Each result shows: pass / fail / answered-not-checked, time, HTTP status, model, key slot and the key's last 4 characters (never the key), what was **sent**, **expected** vs **actual**, the individual checks, and, on failure, the reason in plain words plus the service's own message (keys are redacted from it): bad key, model not found, quota / rate limit, overloaded, timeout, network, bad request, empty answer, or not configured.

- "Run all presets" runs the five presets one after another.
- Recent runs (last 20) are kept in this browser only (localStorage).
- These are real calls and spend provider credits. They are **not** logged to `ai_usage_log` and so do not appear on the AI usage page; there is no limit on how often the owner can run them (by design).
- Owner only: the function checks `is_admin` (403 otherwise); students are redirected away from the page.
- The `ops-selftest` function (secret-protected, no login) remains for scripted deep checks including the full pipeline.
