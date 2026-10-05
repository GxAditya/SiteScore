# SiteScore — SEO Page Auditor

Audit whether AI search and fetch tools can read and understand a live page —
and how that ties to SEO and ranking. Every finding cites a measured value
(lengths, counts, URLs), never a generic tip.

Built with Next.js 14 App Router + TypeScript + Tailwind, deployed on Vercel.
Uses **TinyFish Search + Fetch** (live, `ttl: 0`). Deterministic rule engine in
`lib/`; optional Gemini executive summary (Task 5).

## Setup

Requirements: Node 18+ and npm.

```bash
npm install
cp .env.example .env
# Edit .env and set TINYFISH_API_KEY (get one free at https://agent.tinyfish.ai/api-keys)
# GEMINI_API_KEY is optional — only for the LLM executive summary (see below).
```

## Run

```bash
npm run dev     # local dev at http://localhost:3000
npm run build   # production build (must pass before deploy)
npm run start   # serve the production build at http://localhost:3000
npm run lint    # eslint
```

## Test

```bash
npx tsc --noEmit          # typecheck (strict)
npx -y tsx lib/selftest.ts  # engine self-test: good page outscores thin page,
                            # every fix cites a measured value, scoring deterministic
```

Non-network API paths can be verified against a local server without a valid
key (see `QA.md` for the full matrix and exact commands):

```bash
npm run start &
curl -s -o /dev/null -w "GET / -> %{http_code}\n" http://localhost:3000/
curl -s -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/page"}'
# With no/invalid key: 400 missing_api_key / 401 invalid_api_key.
# With a valid key: full audit JSON (takes up to ~2 min for slow pages).
```

## UI overview

Report tabs jump between Overview, Fixes, Visibility, Readability, and Evidence via a sticky keyboard-navigable bar. Recent audits persist locally with one-click re-run. Export any report as Markdown, JSON, or print. Dark mode persists across visits with no flash. Every input is labeled with inline help; loading announces politely and errors use `role=alert`. All motion respects `prefers-reduced-motion`.

## Architecture

```
browser form (app/page.tsx + components/)
  │  POST /api/audit  { url, query?, tinyfishKey?, llmKey?, llmProvider? }
  ▼
/api/audit (app/api/audit/route.ts, Node runtime, maxDuration 120, no-store)
  │  Phase A: Fetch HTML + Fetch Markdown in parallel (ttl: 0 — LIVE pages only,
  │           never a saved copy), derive target query when missing
  │  Phase B: Search indexation probe (site:<domain> "<slug>") +
  │           Search ranking probe (target query) in parallel
  ▼
deterministic engine (lib/: analyze → score → fixes → connect, + optional llm)
  │
  ▼
single-page report: ScoreGauge, CategoryCards, ConnectionBanner,
ReadabilityPanel (Fetch), VisibilityPanel (Search), FixesList, RawEvidence, ExportBar
```

**Live-audit note:** every Fetch body sends `ttl: 0`
(`app/api/audit/route.ts:307`), and `/api/audit` responds with
`Cache-Control: no-store` — audits are never served from, or stored in, a
server-side cache. The report shows a "Live" badge with `fetchedAt`.

**Server-only keys:** the browser only ever calls `/api/audit`. No page or
component calls `api.search.tinyfish.ai` / `api.fetch.tinyfish.ai` directly,
and `process.env.TINYFISH_API_KEY` is read only in the server route.

## Rate limits (TinyFish free tier)

| API | Limit | How SiteScore stays inside it |
|---|---|---|
| Search | 30 req/min | 2 Search calls per audit (indexation + ranking probes) |
| Fetch | 150 URLs/min | 2 Fetch calls per audit (1 URL × HTML + Markdown formats) |

A single audit consumes 2 Search requests + 2 Fetch URLs. Back-to-back audits
are fine; a burst of >15 audits/min may hit Search throttling and returns
`429 rate_limited` with `retryable:true` (see troubleshooting).

## Environment variables

| Variable | Required | Purpose | Fallback |
|---|---|---|---|
| `TINYFISH_API_KEY` | Yes (or BYOK per request) | Server fallback key for TinyFish Search + Fetch. Get one free at https://agent.tinyfish.ai/api-keys | Per-request `tinyfishKey` in the `/api/audit` body |
| `GEMINI_API_KEY` | No | Server fallback key for the optional LLM executive summary | Per-request `llmKey` with `llmProvider:"gemini"` |

**BYOK + env resolution** (`app/api/audit/route.ts:411-418`): the request-body
`tinyfishKey` wins when present, otherwise `process.env.TINYFISH_API_KEY` is
used. If neither is set → `400 missing_api_key` with a link to the key page.
Keys are never echoed in responses or logs. In the UI, keys go in the
collapsible Advanced section; they live only in page memory for the request
and are never persisted.

## Deploy

### Vercel (primary, Hobby free)

```bash
npm run build          # must pass locally first
vercel --prod
```

Then in the Vercel dashboard → Project Settings → Environment Variables, add
`TINYFISH_API_KEY` (and optionally `GEMINI_API_KEY`), and redeploy so the
values take effect. No other configuration is needed: `vercel.json` uses the
Next.js framework default, the route sets `maxDuration = 120` in code, and
there is no database or persistent server.

### Fallbacks

- **Cloudflare Pages:** supported via the Next.js adapter
  (`@cloudflare/next-on-pages`). Note: the audit route runs up to ~120s;
  confirm the Workers plan timeout covers it, or raise the client timeout
  accordingly. Set the same env vars in Pages → Settings → Environment Variables.
- **Netlify:** deploy with the Next.js Runtime (`@netlify/plugin-nextjs`).
  Function timeout on the free tier is shorter — long audits of slow pages may
  hit it; Vercel remains the recommended target. Set env vars in
  Site settings → Environment variables.

## Troubleshooting

| Symptom (HTTP / `error` code) | Meaning | Fix |
|---|---|---|
| 400 `missing_api_key` | No key via BYOK or server env | Add key under Advanced → API keys, or set `TINYFISH_API_KEY` on the server |
| 401 `invalid_api_key` | TinyFish rejected the key | Check for typos/extra spaces; generate a fresh key at https://agent.tinyfish.ai/api-keys |
| 429 `rate_limited` (`retryable:true`) | Free-tier throttle (Search 30/min, Fetch 150 URLs/min) | Wait ~1 min and retry |
| 200 with `fetch_error_bot_blocked` fail check | Target blocks crawler/assistant fetches | P0 fix in report: allowlist well-behaved fetchers, verify `robots.txt`, re-audit |
| 200 with `fetch_error_login_required` | Page sits behind sign-in | Publish the key content on a public URL and audit that instead |
| 200 with `fetch_error_empty_content` / thin-content fail | Script-only or near-empty page | Server-render core content into HTML (report cites measured word count) |
| 200 with `fetch_error_timeout` / latency warn | Page too slow (or TinyFish slow) | Cut TTFB < ~1s, defer heavy scripts, re-audit and compare `latencyMs` |
| 400 `invalid_url` | Non-http(s) scheme, over 2000 chars, unparseable | Provide a plain `https://…` URL (bare `example.com/page` is auto-prefixed) |
| 400 `private_host_not_allowed` | localhost / LAN / `169.254.x` / metadata hosts | Audits of private hosts are blocked by design; use a public URL |
| 400 `invalid_request` | Malformed JSON or failed zod validation | Send valid JSON matching `{url, query?, tinyfishKey?, llmKey?, llmProvider?}` |
| Client abort after 150s (`request_timeout`) | Very slow page + upstream chain | Retry once; if it repeats, the page itself is too slow — itself a P1 finding |

## API quick reference

`POST /api/audit` (`Content-Type: application/json`):

```json
{ "url": "https://example.com/page", "query": "optional target query",
  "tinyfishKey": "optional BYOK", "llmKey": "optional Gemini key",
  "llmProvider": "gemini|none" }
```

Success returns the contract JSON (`input`, `score`, `fetch`, `search`,
`checks`, `fixes`, `connection`, `aiSummary`, `raw`) — see `tasks.md` for the
full shape and `QA.md` for the verified test matrix (PRD reqs 1–8 → evidence).

## Optional: Gemini AI summary (Task 5)

The deterministic rule engine is the audit; the LLM summary is an optional
extra. **TinyFish Search + Fetch are the only required keys** — without a
Gemini key, audits succeed with `aiSummary.generated=false` and the UI shows
the rule-based summary instead. An invalid key or Gemini outage never fails
an audit (the warning is surfaced, the audit still returns 200).

To enable it, get a free Gemini API key at https://aistudio.google.com
("Get API key"), then either:

```bash
# server env fallback
echo 'GEMINI_API_KEY=AIza...' >> .env
```

or pass it per-request (BYOK, stays server-side via `/api/audit`):

```json
{ "url": "https://example.com/page", "llmProvider": "gemini", "llmKey": "AIza..." }
```

Uses model `gemini-2.0-flash` (`generateContent`, 25s server timeout).
