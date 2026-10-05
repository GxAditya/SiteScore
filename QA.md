# SiteScore — QA Report (Task 6)

Date: 2026-10-05. App: Next.js 14 App Router (`app/page.tsx`, `app/api/audit/route.ts`), engine in `lib/`.

## Build / type / engine results (this sandbox)

| Command | Result |
|---|---|
| `npm run build` | PASS — `✓ Compiled successfully`, 4 static/dynamic routes, `/api/audit` dynamic |
| `npx tsc --noEmit` | PASS — exit 0, no errors |
| `npx -y tsx lib/selftest.ts` | PASS — `SELFTEST PASS`. GOOD page scores 100 (A) > THIN page scores 4 (D); 20 checks + ≥5 fixes each; every fix `why` cites a measured value; query derivation + determinism asserted |

## Known limitation (sandbox)

The `TINYFISH_API_KEY` present in this sandbox is **invalid**: every request that
reaches TinyFish returns HTTP 401. That is the *expected* result here — it proves
URL normalization passed and the server-side proxy is wired correctly (the request
got all the way to TinyFish and back with a well-formed error). Full live
end-to-end audits (200 report JSON with populated Search + Fetch panels) were
therefore **not runnable in this sandbox** and are marked NOT RUN below, with the
exact `curl` commands for an operator with a valid key.

## Test matrix

`S?` = Search contributes, `F?` = Fetch contributes on a successful audit.

| # | Case | URL example | Expected | Actual (sandbox) | S? | F? |
|---|---|---|---|---|---|---|
| 1 | UI loads | `GET /` | 200 + form | 200 on `:3101` and `:3102` | — | — |
| 2 | Valid shape, env key | `{"url":"https://example.com/page"}` | 401 `invalid_api_key` (sandbox key invalid) | 401 `invalid_api_key`, `retryable:false` | n/a (upstream rejected) | n/a |
| 3 | Bogus BYOK key | `{"url":"https://example.com/page","tinyfishKey":"bogus-invalid-key-12345"}` | 401 `invalid_api_key` — proves normalization + proxy wiring | 401 `invalid_api_key` | n/a | n/a |
| 4 | Bare-domain normalization | `{"url":"example.com/page","tinyfishKey":"bogus-…"}` | 401 (i.e. `https://` was prepended; NOT `invalid_url`) | 401 `invalid_api_key` | n/a | n/a |
| 5 | Invalid scheme | `{"url":"ftp://example.com/file"}` | 400 `invalid_url`, no upstream call | 400 `invalid_url` | — | — |
| 6 | Private host: localhost | `{"url":"http://localhost:3000/secret"}` | 400 `private_host_not_allowed` | 400 `private_host_not_allowed` | — | — |
| 7 | Private host: loopback | `{"url":"http://127.0.0.1/admin"}` | 400 `private_host_not_allowed` | 400 `private_host_not_allowed` | — | — |
| 8 | Private host: LAN | `{"url":"http://192.168.1.1/"}` | 400 `private_host_not_allowed` | 400 `private_host_not_allowed` | — | — |
| 9 | Malformed JSON | body `{"url":` | 400 `invalid_request` | 400 `invalid_request` ("must be valid JSON") | — | — |
| 10 | Missing `url` field | `{}` | 400 `invalid_request` + zod details | 400 with `details:[{path:"url"}]` | — | — |
| 11 | Missing key (env unset, no BYOK) | `{"url":"https://example.com/page"}` on server started with `env -u TINYFISH_API_KEY` | 400 `missing_api_key` + docs link | 400 `missing_api_key`, `docs:https://agent.tinyfish.ai/api-keys` | — | — |
| 12 | No server-side caching | any `POST /api/audit` | `Cache-Control: no-store` | `cache-control: no-store` on 400s and 200s (`app/api/audit/route.ts:24,859`) | — | — |
| 13 | No browser→TinyFish calls | `grep -rn "search.tinyfish.ai\|fetch.tinyfish.ai" app/page.tsx app/layout.tsx components/` | no matches | no matches (exit 1); browser only calls `/api/audit` (`app/page.tsx:58`) | yes (server-only) | yes (server-only) |
| 14 | No key in client bundle | `grep -rn TINYFISH_API_KEY app/ components/` | server-only usage + UI placeholder strings | only `process.env` read is `app/api/audit/route.ts:411` (server route); component hits are label/placeholder text | — | — |
| 15 | Engine: good > thin, measured fixes | `lib/selftest.ts` fixtures | GOOD outscores THIN; fixes cite values | GOOD 100 (A) vs THIN 4 (D); THIN top fix cites `robots meta "noindex, nofollow"` + `60-word page` | yes (ranking fixtures) | yes (parse fixtures) |
| 16 | NOT RUN (needs valid key): blog post | `{"url":"https://example.com/blog/some-post"}` | 200; `fetch.wordCount` > 0; `search.indexation.indexed` boolean; top P0 fix recorded | NOT RUN — sandbox key 401 | must be yes | must be yes |
| 17 | NOT RUN: JS-heavy product page | `{"url":"https://<js-heavy-shop>/products/<id>"}` | 200; `empty_content`/thin-content check fires or wordCount > 0; fixes cite measured counts | NOT RUN | must be yes | must be yes |
| 18 | NOT RUN: thin/empty page | `{"url":"https://example.com/thin-page"}` | 200; readability fail (`word count <300`); P0 fix with measured count | NOT RUN | must be yes | must be yes |
| 19 | NOT RUN: redirected URL | `{"url":"https://<old-slug-that-301s>"}` | 200; `fetch.redirected:true`, `input.finalUrl` ≠ `input.url`; technical check cites both URLs | NOT RUN | must be yes | must be yes |
| 20 | NOT RUN: bot-protected URL | `{"url":"https://<bot-walled-page>"}` | 200 (not 500) with `fetch_error_bot_blocked` fail check + P0 allowlist fix | NOT RUN | must be yes | must be yes |

Cases 16–20 assert Task 6's core invariant: **Search AND Fetch both visibly
contribute on every success** (fail the QA run if either panel is empty). The
operator commands below are written so each row can be executed verbatim.

## Operator commands (valid key required for 16–20)

```bash
# one-time setup
npm install
cp .env.example .env
# put a VALID key in .env: TINYFISH_API_KEY=<key from https://agent.tinyfish.ai/api-keys>
npm run build && npm run start   # serves http://localhost:3000

# UI smoke test
curl -s -o /dev/null -w "GET / -> %{http_code}\n" http://localhost:3000/

# non-network paths (work with any key, even none where noted)
curl -s -X POST http://localhost:3000/api/audit -H "Content-Type: application/json" \
  -d '{"url":"ftp://example.com/file"}'            # -> 400 invalid_url
curl -s -X POST http://localhost:3000/api/audit -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:3000/secret"}'      # -> 400 private_host_not_allowed
curl -s -X POST http://localhost:3000/api/audit -H "Content-Type: application/json" \
  -d '{"url":'                                     # -> 400 invalid_request (malformed JSON)

# missing-key path (env unset)
env -u TINYFISH_API_KEY npm run start -- -p 3102 &
curl -s -X POST http://localhost:3102/api/audit -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/page"}'          # -> 400 missing_api_key

# LIVE audits (valid key; each takes up to ~2 min, client timeout is 150s)
for U in \
  "https://example.com/blog/some-post" \
  "https://<js-heavy-shop>/products/<id>" \
  "https://example.com/thin-page" \
  "https://<old-slug-that-301s>" \
  "https://<bot-walled-page>" ; do
  curl -s -m 150 -X POST http://localhost:3000/api/audit \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$U\"}" | head -c 2000; echo
done
# For each live row record: score.total, search.indexation.indexed,
# search.ranking.rank, fetch.wordCount, top P0 fix title — and confirm
# Search panel (indexation/ranking/competitors) AND Fetch panel
# (html/markdown excerpts, wordCount) are both non-empty.
```

## PRD requirements → evidence

| PRD req | Evidence |
|---|---|
| 1. Takes a URL (and optionally a target search query) | `app/api/audit/route.ts:26-35` (`BodySchema`: required `url` ≤2000ch, optional `query`); form fields `components/AuditForm.tsx:45-73` (`audit-url`, `audit-query`, query marked optional) |
| 2. Uses TinyFish Search and Fetch | `app/api/audit/route.ts:289-332` (`tinyfishFetch`: `POST https://api.fetch.tinyfish.ai`, `X-API-Key`, `ttl:0`); `app/api/audit/route.ts:334-362` (`tinyfishSearch`: `GET https://api.search.tinyfish.ai`, site: + ranking probes `543-546`); key resolution BYOK+env `411-418` |
| 3. Report covers what AI tools can/can't read, visibility gaps, concrete fixes | `components/ReadabilityPanel.tsx:1-124` (CAN-read vs CAN'T lists from actual fetch); `components/VisibilityPanel.tsx:1-216` (indexed yes/no, rank table, competitors); `components/FixesList.tsx:1-168` (P0→P2 with copy-code buttons) |
| 4. Search and Fetch both contribute meaningfully | Route fans out Fetch HTML + Fetch Markdown (`424-427`) then Search indexation + ranking (`543-546`); engine consumes both (`lib/engine.ts:39-110`); UI renders `VisibilityPanel` (search) and `ReadabilityPanel` (fetch) side by side (`app/page.tsx:170-171`); live QA rows 16–20 require both panels non-empty |
| 5. Audits live pages, not saved copies | `ttl: 0` in every Fetch body `app/api/audit/route.ts:307` (comment `:301`); `Cache-Control: no-store` on all responses (`:24`, `:859`); "Live" badge + `fetchedAt` in `components/ScoreGauge.tsx`; footer note `app/page.tsx:188` |
| 6. Findings specific/actionable, not generic tips | `lib/fixes.ts:63-418` — every fix has `why` with measured values (lengths/counts/URLs) + `how` steps + `codeBefore/codeAfter`; `lib/analyze.ts:291-633` checks carry `evidence` strings; selftest asserts fixes cite values (`lib/selftest.ts`, PASS) |
| 7. Works for any URL | No domain allowlist; zod http/https validation + normalization (prepend `https://`, strip fragment: `app/api/audit/route.ts:153-164`); only localhost/private/metadata hosts rejected (`167-189`); query auto-derives when missing (`lib/derive-query.ts:65-82`) |
| 8. Connects readability to search visibility | `lib/connect.ts:29-84` (`buildConnection`: 2–4 sentence summary + correlation tying extraction evidence to ranking outcome); rendered as `ConnectionBanner` (`components/ConnectionBanner.tsx`, wired `app/page.tsx:165-168`); engine feeds it indexed/rank/competitor data (`lib/engine.ts:77-107`) |

## Config files verified (no changes needed)

- `.env.example` — `TINYFISH_API_KEY=` + `GEMINI_API_KEY=` (optional), matches route (`route.ts:411`) and `lib/llm.ts:100`.
- `vercel.json` — `{"framework":"nextjs"}`; Hobby-compatible (no server pinning needed; `maxDuration=120` is set in code at `route.ts:8`).
- `.gitignore` — ignores `.env*` except `!.env.example`, plus `node_modules/`, `.next/`, `.vercel`.
