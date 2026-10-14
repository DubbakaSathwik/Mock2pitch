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
| slide_reading | `meta/llama-4-maverick-17b-128e-instruct` | **RETIRED**: not in `/v1/models`, every call returns **HTTP 410 Gone**. Must be replaced. |
| speech_to_text | Parakeet via in-process gRPC | first run failed with a generic "network" error after 80 ms; `ops-selftest` had no bundled `.proto` files, so the cause was not isolated. Re-test after the self-test fix (reports the real reason). |

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
