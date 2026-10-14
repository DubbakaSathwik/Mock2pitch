# Technical spikes (§3) — status and results

## LIVE RESULTS (2026-10-14, run inside the Supabase Edge Runtime by `ops-selftest`; the sandbox itself still cannot reach NVIDIA/R2)

### Cloudflare R2 — real bucket `mock2pitch-dev`: **7/7 checks pass**
| Check | Result |
|---|---|
| server-side put / head / get / delete | pass |
| presigned PUT with the exact `Content-Type` + `Content-Length` | accepted (200) |
| presigned PUT with a **different Content-Type** | **rejected (403), no object created** → signed type is enforced by R2 |
| presigned PUT with a **longer body than the signed Content-Length** | **rejected (403), no object created** → signed length is enforced by R2 (this was the open question) |
| presigned GET; same URL without the signature | 200; unsigned → 400 |
| CORS preflight | `http://localhost:3000` → 204 with `Access-Control-Allow-Origin: http://localhost:3000`; `https://evil.example` → 403, no allow-origin |
| prefix delete | 4 objects removed, 0 left |
Not yet covered: the Netlify origin (not in the CORS policy yet — add it when the site exists).

### NVIDIA — keys valid, 80 models listed (`GET /v1/models` is public; keys: 1 primary per purpose configured)
| Purpose | Model | Result |
|---|---|---|
| report_generation | `nvidia/nemotron-3-ultra-550b-a55b` | **exact id confirmed (listed)**. 5/5 calls HTTP 200, **p50 1.2 s, p95 2.0 s** (small prompt), token-usage fields present, `response_format: json_object` **accepted (200)** |
| slide_reading | `meta/llama-4-maverick-17b-128e-instruct` | **RETIRED**: not in `/v1/models`, every call returns **HTTP 410 Gone**. Replaced (see below). |
| slide_reading candidates | `meta/llama-3.2-11b-vision-instruct` | **works**: 3/3 HTTP 200, **p50 9.4 s, p95 10.2 s**, read the fixture title correctly; only 1/3 answers matched our strict JSON schema (parser made tolerant, see `ai.md`). **Chosen default.** |
| | `meta/llama-3.2-90b-vision-instruct` | first call exceeded 40 s (timeout) → too slow for 10 slides |
| | `google/gemma-3-12b-it`, `microsoft/phi-3-vision-128k-instruct` | listed in `/v1/models` but **HTTP 404** when called: listed ≠ callable for this account |
| inline image size | 11B vision model | images of 133 KB, 233 KB, 433 KB, 833 KB and **1.6 MB all accepted (HTTP 200)** → no 180 KB limit; `SLIDE_IMAGE_MAX_BYTES` raised to **1,000,000** |
| speech_to_text | Parakeet via in-process gRPC | **fails inside the Supabase Edge Runtime**: `NotFound: path not found: …/functions/ops-selftest/riva/proto/riva_asr.proto` — the runtime does not expose bundled files to protobuf loaders by path. **Fix:** the protocol is now embedded as a generated JSON descriptor (`_shared/riva/descriptor.ts`, `scripts/gen-riva-descriptor.mjs`), so no file access is needed. Re-tested, see FINAL RESULTS below. |

### Pipeline on the real stack (synthetic user, run 1 — stopped early by the two NVIDIA findings above)
| Step | Result |
|---|---|
| create user through the real Auth admin API; `handle_new_user` trigger creates the profile (`student`) | pass |
| `svc_complete_deck_upload` on Postgres 17: one daily session consumed atomically, image rows created; slide JPEGs written to R2 | pass |
| `deck-process` | fails as designed: retired slide model → `decks.status='failed'`, `error_code='ai_unavailable'` (no extra session consumed, key slot flagged `http_410`) |
| `session-analyse` | fails as designed: speech-to-text error → `practice_sessions.status='failed'`, `error_code='ai_unavailable'`, audio kept |
| cleanup | pass: 0 users, profiles, decks, sessions, files left; the 3 R2 objects removed; AI usage rows kept with `user_id` null |

Vision-capable models present in the live list: `meta/llama-3.2-90b-vision-instruct`, `meta/llama-3.2-11b-vision-instruct`, `microsoft/phi-3-vision-128k-instruct`, `google/gemma-3-12b-it`, `google/gemma-3-4b-it`, `nvidia/vila`, `nvidia/neva-22b`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (the previously listed fallback `nvidia/nemotron-nano-12b-v2-vl` is **not** present). Also listed: `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `nvidia/llama-3.1-nemotron-ultra-253b-v1`.

---

> **Honest summary:** every spike that needs the public internet to NVIDIA or Cloudflare is **BLOCKED** in this environment (egress to `integrate.api.nvidia.com` is denied; no NVIDIA keys, no R2 token). What *could* be verified without them was verified and is listed separately. The scripts to finish the live checks are ready: `npm run spike:nvidia` and `RUN_LIVE_AI_TESTS=1 npm run test:live-ai`.

## 3.2 NVIDIA model verification — BLOCKED (needs keys + network)
| Purpose | Default configured | Status |
|---|---|---|
| slide_reading | `meta/llama-4-maverick-17b-128e-instruct` | not verified live. Fallback order documented: `nvidia/nemotron-nano-12b-v2-vl`, `meta/llama-3.2-90b-vision-instruct` |
| speech_to_text | Parakeet TDT 0.6B v2 (Riva function id via `NVIDIA_ASR_FUNCTION_ID`) | not verified live. Fallbacks: Whisper Large v3, Canary 1B |
| report_generation | `nvidia/nemotron-3-ultra-550b-a55b` | exact id not confirmed. Fallbacks: `nvidia/nemotron-3.5-lightning-30b-a3b`, `meta/llama-3.3-70b-instruct` |

Still to record when keys exist (the script prints all of it): `/v1/models` presence, p50/p95 latency over 5 calls, token-usage fields, 429/401/5xx shapes and any `Retry-After`, vision inline-size limit, JSON reliability (and whether `response_format: json_object` is accepted — it is **not** sent today because an unsupported parameter would 400), and filler retention.

### Decisions taken without live data (all one-line changes)
- **Slide image rule is provisional and conservative:** `SLIDE_IMAGE_MAX_WIDTH=1280`, quality 0.8 → floor 0.5, min width 800, **`SLIDE_IMAGE_MAX_BYTES=180_000`**. NVIDIA's hosted vision endpoints have historically limited inline base64 images to roughly this size; larger images need NVIDIA's asset-upload mechanism, which is **not implemented**. The server returns these numbers in `deck-upload-complete → rules`, so Phase 2 reads them instead of hard-coding. If the live spike shows a higher limit, change the constant only.
- Report timeout 90 s, slide 45 s, ASR 60 s per ≤60 s chunk — from the prompt, unmeasured.
- Filler accuracy depends on the ASR model keeping "um/uh". Not measured. `tests/fixtures/clip-fillers-synthetic.wav` is flite text-to-speech, which exercises plumbing only; a **human recording** is needed for this finding. Scoring weights are unchanged regardless.

## 3.3 gRPC runtime — decision and evidence
**Both options are implemented behind one `AsrCall` interface; the default in code is Option A when `INTERNAL_TRANSCRIBE_URL` is unset, Option B when it is set.** Recommended for first deployment: **Option B**, because Option A could only be proven in plain Deno, not in the Supabase Edge Runtime.

| Evidence | Result |
|---|---|
| Official Riva protos (`riva_asr/audio/common.proto`, Apache-2.0) vendored from `nvidia-riva/common` into `_shared/riva/riva/proto/` | done |
| Client builds the Offline `Recognize` request (LINEAR_PCM, 16 kHz, mono, en-US, word offsets, auto punctuation) with `function-id` + `authorization: Bearer` metadata | verified against a **local gRPC server using the same protos** (`tests/unit/riva.test.ts`) |
| `@grpc/grpc-js` + proto-loader under **Deno 2.9.6** against that server | works (`tests/functions/deno-runtime.test.ts`) |
| Option B route `app/api/internal/transcribe` (404 without secret, 413 size cap, error→status mapping) + Edge-side transport | verified in `tests/unit/transcribe-route.test.ts`; Next build traces the `.proto` files into the serverless bundle |
| Real transcription against `grpc.nvcf.nvidia.com:443` | **BLOCKED** (network + keys) |
| Behaviour inside Supabase's Edge Runtime (HTTP/2 client, 2 s CPU limit) | **not verified** |
| Netlify synchronous timeout for Option B | **not measured**. The design keeps each call to one ≤ 60 s PCM chunk (≈1.9 MB, under Netlify's 6 MB body limit) so only a short call is needed |

Deviation from the prompt's Option B text: the Edge Function sends the **raw PCM chunk in the request body** instead of the route reading the clip from R2 with a presigned GET. Same security model (secret-protected, server-to-server), no second R2 code path, and chunking/merging stays in one place (`_shared/ai/asr.ts`). Key routing stays in the Edge Function; the chosen key travels in an `x-asr-key` header over TLS.

## Other facts established
- `supabase db reset`/`supabase start` could not be run (no container images). Migrations were applied to a real PostgreSQL 16.15 server with a Supabase stand-in (`tests/db/supabase-stub.sql`): roles `anon/authenticated/service_role`, `auth.users/identities`, `auth.uid()`, Supabase's default privileges, and the `supabase_realtime` publication. **Re-run `supabase db reset` on a machine with Docker before trusting it as final.**
- Real bug caught by the harness: with `search_path = ''`, `citext = citext` is not resolvable and silently falls back to case-sensitive text equality (owner emails in different case would not match). Fixed with `lower()` comparisons.

## FINAL LIVE RESULTS (2026-10-14, later runs, same method)

### Speech-to-text (Parakeet TDT 0.6B, `grpc.nvcf.nvidia.com:443`) — **works inside the Supabase Edge Runtime (Option A)**
| Finding | Detail |
|---|---|
| `@grpc/grpc-js` channel in the Edge Runtime | **never connects**: `Deadline exceeded … Waiting for LB pick` (15 s probe and 45/90 s transcribe). Not a firewall: from the same function raw TLS with ALPN `h2`, `fetch` (401 without auth) and `node:http2` all connect to the host in 11–16 ms. |
| Fix | `_shared/riva/client.ts` now sends the gRPC unary call itself over `node:http2` (POST, `content-type: application/grpc`, 5-byte message prefix, status read from trailers); protobufjs (via proto-loader, embedded descriptor) only (de)serialises messages. `grpc-js` is no longer used by the product code (only by the test mock server). |
| Auth/config probe | `GetRivaSpeechRecognitionConfig` → 200 in ~1.1 s, model list `["parakeet-tdt-0.6b-en-US-asr-offline"]` |
| Transcription | 3/3 HTTP 200, **p50 1.70 s, p95 1.71 s** for a 6 s clip |
| Transcript | "So um we built the system, and it actually works basically 94% accuracy." |
| Filler retention | script had 4 fillers (um, uh, actually, basically); **3 survived** (um, actually, basically; "uh" was dropped). Filler detection therefore works but under-counts slightly; a human recording is still the real test (the fixture is text-to-speech). |
| Decision | **Option A (in-process) is the production path.** Option B (Next.js route) stays implemented but is not needed. |

### Slide reading — `meta/llama-3.2-11b-vision-instruct`
| Attempt | Valid JSON |
|---|---|
| original long-schema system prompt | 1/3 (answers in Markdown) |
| **B: "you are a JSON API" system prompt + JSON shape as an example in the user turn** | **2/2, then 3/3 in the production code path**, p50 ≈ 8 s. **Adopted** (`prompts/slide-reading.ts`). |
| C: `response_format: json_object` | 0/2 (parameter ignored by this model) |
| D: `nvext.guided_json` | 0/1 (ignored) |
| E: vision describes, report model structures | 2/2 but p50 ≈ 22 s per slide; not needed |
The Zod schema also stays tolerant (null/missing text fields, `{point: "..."}` items, clamped lengths).

### Pipeline on the real stack (synthetic user) — **all 7 steps pass**
| Step | Result |
|---|---|
| create user via Auth admin API; trigger creates profile `student` | pass (0.9 s) |
| `svc_complete_deck_upload`: 1 daily session consumed, 2 slide JPEGs in R2 | pass (1.5 s) |
| `deck-process`: vision model reads both slides → deck `ready` | pass (8.9 s), key points 5 per slide |
| session prepared with one recorded clip (slide 2 unrecorded) | pass |
| `session-analyse`: transcribe → metrics → report → finalise → audio deleted | pass (**33.6 s** end to end, one attempt); transcript correct; `formula_matches: true`; unrecorded slide still has a row; scores coverage 10 / clarity 65 / timing 0 / fillers 10 → overall 22 (the clip is 6 s against a 30 s target and covers 1 of 5 points, so a low score is correct) |
| usage log | slide_reading ×2, speech_to_text ×1, report_generation ×1, all `success`, no prompts/keys |
| cleanup | pass: user cascade-deleted, R2 objects removed; afterwards 0 profiles/decks/sessions and 0 `selftest-` users remain |
Note: the report call dominates the 34 s (`nvidia/nemotron-3-ultra-550b-a55b` with the full prompt); `session-analyse` runs in the background after a 202, so the student sees progress through Realtime, not a blocked request.

### Image-size rule (final)
Inline base64 images up to 1.6 MB were accepted by the vision endpoint, so the provisional 180 KB rule is retired: `SLIDE_IMAGE_MAX_BYTES = 1,000,000`, width 1280, quality 0.8 → 0.5, min width 800.
