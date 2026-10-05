# SiteScore — Build Tasks (Next.js on Vercel, TinyFish Search + Fetch)

Source: `PRD.md`. Stack decision: Next.js App Router on Vercel (fallback: Cloudflare > Netlify).
Auth: BYOK + env fallback (`TINYFISH_API_KEY`). Engine: deterministic rules + optional LLM summary. Report: full + export. Query: auto-derive when missing.

## API contracts (do not deviate)

### TinyFish Search — `GET https://api.search.tinyfish.ai`
- Header: `X-API-Key: <key>`
- Query params: `query` (required), `include_domains`, `exclude_domains`, `location`, `language`, `page`
- Response: `{ query, results: [{ position, site_name, title, snippet, url }], total_results, page }`
- Free, 30 req/min. Docs: https://docs.tinyfish.ai/search-api

### TinyFish Fetch — `POST https://api.fetch.tinyfish.ai`
- Headers: `X-API-Key`, `Content-Type: application/json`
- Body: `{ urls: string[1..10], format: "html"|"markdown", links?: bool, image_links?: bool, ttl: 0, per_url_timeout_ms?: number }`
- **Must send `ttl: 0` (live fetch, PRD req #5).** Max 10 URLs/req, 110s backend timeout, set client timeout ≥150s.
- Response: `{ results: [{ url, final_url, title, description, language, author, published_date, text, links?, image_links?, latency_ms, format }], errors: [{ url, error, status? }] }`
- Per-URL errors (`bot_blocked`, `login_required`, `empty_content`, …) come with HTTP 200 — handle them, don't throw.
- Free, 150 URLs/min. Docs: https://docs.tinyfish.ai/fetch-api

### Internal — `POST /api/audit`
Request (JSON):
```json
{ "url": "https://example.com/page", "query": "optional target query", "tinyfishKey": "optional BYOK", "llmKey": "optional Gemini key", "llmProvider": "gemini|none" }
```
Resolution: `tinyfishKey || process.env.TINYFISH_API_KEY`. If neither → 400 with `missing_api_key`.
Response (JSON):
```json
{
  "input": { "url": "", "finalUrl": "", "query": "", "querySource": "user|auto", "fetchedAt": "ISO" },
  "score": { "total": 0, "readability": 0, "visibility": 0, "technical": 0 },
  "fetch": { "html": {}, "markdown": {}, "redirected": false, "wordCount": 0, "latencyMs": 0 },
  "search": { "indexation": {}, "ranking": {}, "competitors": [] },
  "checks": [{ "id": "", "category": "readability|visibility|technical", "status": "pass|warn|fail", "label": "", "detail": "", "evidence": "" }],
  "fixes": [{ "priority": "P0|P1|P2", "title": "", "why": "", "how": "", "codeBefore": "", "codeAfter": "" }],
  "connection": { "summary": "", "correlation": "" },
  "aiSummary": { "text": "", "provider": "none|gemini", "generated": false },
  "raw": { "searchQueries": [], "fetchErrors": [] }
}
```

## Task 1 — Scaffolding + config (assign: subagent-A)
- [ ] Scaffold Next.js 14+ App Router + TypeScript + Tailwind in `/home/aditya/Dev/Tinybounties/SiteScore` (currently only `PRD.md` exists). Use `create-next-app`-equivalent minimal files; do NOT nest a second repo inside.
- [ ] Files: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/api/audit/route.ts` (stub), `lib/` dir, `.env.example` (`TINYFISH_API_KEY=`, `GEMINI_API_KEY=` optional), `.gitignore` (`.env*`), `vercel.json` (or framework default), `README.md` (run + deploy).
- [ ] `package.json` scripts: `dev`, `build`, `start`, `lint`. No DB, no auth lib, no heavy deps. Allowed: `cheerio` (HTML parse), `zod` (validation).
- [ ] Acceptance: `npm run build` passes; `vercel --prod` deploys on Hobby free with only env vars; no API key in client bundle (`grep -r TINYFISH_API_KEY app/ components/` shows server-only usage).

## Task 2 — Server proxy `/api/audit` (assign: subagent-B, depends: Task 1 contracts)
- [ ] `app/api/audit/route.ts` (Node runtime, `export const maxDuration = 120`): validate `url` with zod (http/https only, reject localhost/private IP/metadata hosts), normalize (add https:// if bare, strip fragments, cap length 2000).
- [ ] Resolve key BYOK+env; 400 `missing_api_key` with message linking to `https://agent.tinyfish.ai/api-keys` if absent. Never echo key in response/logs.
- [ ] Parallel fan-out with `Promise.allSettled` + `AbortController` (client timeout 140s):
  1. Fetch HTML: `POST api.fetch.tinyfish.ai { urls:[url], format:"html", links:true, image_links:true, ttl:0 }`
  2. Fetch Markdown: same with `format:"markdown"` (for AI-readability word count/structure)
  3. Search indexation: `GET api.search.tinyfish.ai?query=site:<domain> "<slug>"` + `include_domains=<domain>` variant — record whether normalized URL appears.
  4. Search ranking: `GET ...?query=<user query OR auto placeholder>` — if query missing at this stage, use `title` from Fetch result if available else domain; frontend may do two-phase (fetch first, then search) OR server derives after fetch resolves then fires search. Implement two-phase inside route: fetch → derive → search.
- [ ] Map Fetch `errors[]` to user-facing states: `bot_blocked`/`login_required`/`empty_content`/`timeout`/`page_not_found` → 200 response with `checks` fail + `fixes` entry, not a 500. Only 500 on TinyFish 5xx/429 (surface `retryable:true`).
- [ ] Acceptance: `curl POST localhost:3000/api/audit` with real URL returns contract JSON; `ttl:0` present in outgoing fetch bodies (log-proof via test); private-IP URL rejected 400; missing key 400; bot-blocked URL yields actionable fail check.

## Task 3 — Audit engine `lib/` (assign: subagent-C, depends: Task 2 shapes)
- [ ] `lib/derive-query.ts`: auto-derive when `query` empty — from fetched `<title>` (strip `| Site` suffix), else H1, else meta description first 8 words, else domain. Return `{ query, querySource }`. Cap 120 chars.
- [ ] `lib/analyze.ts` (pure, unit-testable, no fetch): parse HTML with cheerio, markdown text for counts.
  - Readability (40 pts): `title` present 50-60ch, meta `description` 120-160ch, single H1, H2 hierarchy, word count ≥600 (fail <300), `og:title/description/image`, canonical link, `lang` attr, image `alt` coverage from `image_links` vs `<img alt>`, JSON-LD schema presence, `published_date/author` presence.
  - Visibility (35 pts): indexed? (exact/final URL in site: results), ranks in top-10 for target query? (position recorded), title/snippet match query terms?, competitor gap (count of outranking same-intent pages).
  - Technical (25 pts): redirected? (url≠final_url), latency >4s warn, missing viewport/robots/canonical, thin content + `empty_content` risk.
- [ ] `lib/score.ts`: 0-100 weighted total + per-category subscores, grade (A ≥85, B ≥70, C ≥50, D else). Deterministic — same input → same output.
- [ ] `lib/fixes.ts`: emit ≥5 specific fixes ordered P0→P2, each with `why` (evidence: actual lengths/counts/URLs), `how` (steps), `codeBefore/codeAfter` snippets (e.g. exact `<title>` rewrite using page's own keywords, meta description rewrite ≤160ch, H1 fix, OG tags, alt text, schema block). Never generic ("improve SEO") — cite measured values.
- [ ] `lib/connect.ts`: 2-4 sentence `summary` + `correlation` explicitly tying readability evidence to visibility outcome (e.g. "Fetch extracts 180 words with no H1 → Search snippet falls back to nav text → ranks #0 for '…' while competitor X with 1200 words + FAQ schema ranks #2").
- [ ] Acceptance: unit test (`npm test` or `node --test`) with 2 fixtures (good page, thin page) asserts score ordering good>thin and every fix cites a measured value.

## Task 4 — Frontend single-page report (assign: subagent-D, depends: Tasks 2+3)
- [ ] `app/page.tsx` + `components/`: `AuditForm` (url, query optional, collapsible advanced: TinyFish key, Gemini key, note "key stays server-side via /api/audit proxy"), loading state with staged progress ("Fetching live page… Searching visibility… Scoring…"), error states for every Fetch error code with next action.
- [ ] Report: `ScoreGauge` (0-100 + grade + fetchedAt "Live" badge), `CategoryCards` (readability/visibility/technical bars), `ConnectionBanner` (readability→visibility narrative), `FixesList` (P0/P1/P2 grouped, copy-code buttons), `VisibilityPanel` (indexed yes/no, rank position table, snippet vs query term highlights, competitors), `ReadabilityPanel` (what AI CAN read ✅ vs CAN'T ❌ lists from actual fetch), `RawEvidence` (collapsible markdown excerpt, search JSON).
- [ ] Export: Copy Markdown report, Download JSON, `window.print()` stylesheet. Mobile-responsive, no emojis (use text/SVG), accessible labels.
- [ ] No direct `api.search/fetch.tinyfish.ai` calls from browser — all through `/api/audit`. No key in localStorage except optional session-memory BYOK field (never persisted without consent).
- [ ] Acceptance: audit any URL end-to-end in UI; empty query auto-derives and displays `querySource:auto + derived query`; report renders all panels; exports work; Lighthouse-ish no-console-error run.

## Task 5 — Optional LLM summary (assign: subagent-E, depends: Tasks 2+3)
- [ ] Server-only `lib/llm.ts`: if `llmKey` present and `llmProvider=gemini`, call Gemini `generateContent` (free-tier model `gemini-2.0-flash` or current) with rule findings as context, prompt: "Write 5-line executive summary + 3 same-day actions, cite measured values, no generic tips." Timeout 25s, failure → `generated:false`, never fail the audit.
- [ ] If absent → `aiSummary.generated=false` and UI shows rule-based summary instead. Document in README where to get a free Gemini key + that TinyFish Search/Fetch remain the only required keys.
- [ ] Acceptance: without key audit succeeds with rule summary; with invalid key audit still succeeds (LLM skipped, warning surfaced); with valid key summary cites numbers from checks.

## Task 6 — QA + deploy docs (assign: subagent-F, depends: Tasks 1-5)
- [ ] Test matrix (record results in `QA.md`): blog post URL, JS-heavy product page, thin/empty page, redirected URL, bot-protected URL, invalid URL, missing-key case. For each: score, indexed?, rank, top P0 fix. Assert Search AND Fetch both visibly contribute on every success (fail task if either panel empty).
- [ ] `README.md`: setup (`npm i`, `cp .env.example .env`, set `TINYFISH_API_KEY`), run, test, deploy buttons/steps for Vercel (primary: `vercel --prod`, env var in dashboard), fallback notes for Cloudflare/Netlify. Include architecture diagram (browser → /api/audit → TinyFish Search+Fetch) + `ttl:0` live-audit note + rate limits (30 search/min, 150 fetch/min) + troubleshooting table (401/429/bot_blocked).
- [ ] Acceptance: fresh clone → `npm i && npm run build` → Vercel Hobby deploy works; PRD reqs 1-8 each mapped to a QA row in `QA.md`.

## Global constraints
- Live pages only (`ttl:0`); no caching of audits server-side (browser cache `no-store` on `/api/audit`).
- Findings cite measured values + URLs; no generic tips.
- Free-tier deployable: no persistent server, no DB, no paid APIs required. TinyFish Search+Fetch free; Gemini optional.
- License + AI disclosure if publishing write-up later (not in this build).
