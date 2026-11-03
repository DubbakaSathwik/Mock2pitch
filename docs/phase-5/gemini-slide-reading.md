# Slide reading on Google Gemini (replaces the NVIDIA vision model)

**Why:** `meta/llama-3.2-11b-vision-instruct` was retired by NVIDIA (HTTP 404 on every call). Every deck failed with "Our AI is busy right now" because the
backend reported *any* AI failure as "busy". Slide reading now runs on Google Gemini through its OpenAI-compatible endpoint
(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`). Report generation and speech-to-text are unchanged (NVIDIA).

## Set it up (Supabase → Edge Functions → Secrets)
| Secret | Value |
|---|---|
| `GEMINI_SLIDE_KEY_PRIMARY` | API key from https://aistudio.google.com/apikey. Use a billing-enabled project: free-tier prompts may be used by Google to improve its products, and these are students' slides |
| `GEMINI_SLIDE_KEY_FALLBACK_1` / `_2` | optional extra keys (a second Google project gives extra capacity; keys in the same project share quota) |
| `GEMINI_SLIDE_MODEL` | `gemini-flash-lite-latest`: fast, high-capacity alias; reading a slide image needs no deep reasoning. (`gemini-flash-latest` was tried first and answered 503 "overloaded" or took 30 s+; pin an exact model id if you need fixed behaviour) |
| `GEMINI_SLIDE_FALLBACK_MODEL` | optional, e.g. `gemini-flash-latest`; tried when the primary model is gone (404/410) or overloaded on every key (503 / timeouts) |
| `GEMINI_KEY_RPM_SOFT_LIMIT` | optional, default 30; use about 8 on the free tier |

Delete the old `NVIDIA_SLIDE_MODEL` and `NVIDIA_SLIDE_KEY_*` secrets; nothing reads them any more. `NVIDIA_KEY_RPM_SOFT_LIMIT` still applies to the NVIDIA purposes.
Then redeploy the functions (push to `main`, or run the "Deploy Supabase Edge Functions" workflow).

## Verify
1. `GET <supabase-url>/functions/v1/health`: public, free (no AI calls). `200` = database, storage and a primary key for all three purposes are in place. `503` names the failing part.
2. `POST <supabase-url>/functions/v1/ops-selftest` with header `x-internal-secret` and body `{"check":"gemini"}`: real calls (key accepted, fixture slide read with schema-valid JSON 3/3, optional fallback model, image-size probe). `{"check":"gemini","slide_model":"<candidate>"}` tries another model without changing the secret.
3. `{"check":"pipeline"}` runs upload → slide reading → analysis → report with a throw-away user.
4. The web app has `GET /api/health` (liveness + "is a backend configured").

## What changed in behaviour
- Slide calls time out after 30 s (was 45 s). A 503 or timeout no longer locks the key for 30 s (Gemini overload is per model), so the fallback model is tried straight away; 429 and bad-key cool-downs still apply.
- HTTP 404/410 (model retired or renamed) is now `model_unavailable`: no key cool-down, no rotation. The fallback model is tried; otherwise the deck fails as `misconfigured` ("The service isn't set up yet… try again") instead of "AI is busy". Try again works once the secret is fixed.
- Gemini answers an invalid key with HTTP **400** "API key not valid": that is now treated as an auth failure (key cooled down 10 min, next key used) instead of a bad image that silently produced blank slides.
- After a real "AI busy" failure the Reading screen counts down 30 s before enabling Try again (the key is cooling down server-side, so an instant retry only fails again).
- A deck the sweeper timed out (`upload_timeout`) offers "Upload again" instead of a Try again that could never succeed.
- Added `app/icon.svg`: the app had no favicon, so every page logged a 404 (which the Playwright fixtures treat as a failure).
