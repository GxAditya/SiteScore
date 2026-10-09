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
npx -y tsx lib/security/selftest.ts  # 37 security assertions: SSRF bypasses,
                            # rate limits, budgets, AES-GCM rotation/revocation,
                            # redaction, prompt-injection defense. Exits non-zero on failure.
```

See **`SECURITY.md`** for the full threat model, findings by severity, and the
list of environment variables that control cost protection.

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

## Rate limits and cost protection

**Every audit costs 4 upstream calls** (2 Fetch + 2 Search). SiteScore enforces
hard server-side limits *before* any upstream call, so a blocked request costs
nothing:

| Guard | Default (production) | Purpose |
|---|---|---|
| `RATE_LIMIT_PER_MINUTE` | 10 | Per key fingerprint **and** per client IP |
| `RATE_LIMIT_PER_HOUR` | 120 | Per identity |
| `RATE_LIMIT_PER_DAY` | 500 | Per identity — hard spend ceiling per client |
| `RATE_LIMIT_GLOBAL_PER_HOUR` | 3,000 | Platform-wide, across every key and IP |
| `RATE_LIMIT_GLOBAL_PER_DAY` | 20,000 | Platform-wide daily bill ceiling |
| `RATE_LIMIT_MAX_CONCURRENT` | 10 | Blocks parallel-request cost amplification |
| `RATE_LIMIT_MAX_CONCURRENT_PER_IDENTITY` | 2 | One browser can't fan out |
| `LLM_PLATFORM_KEY_PER_DAY` | 50 | Ceiling on platform-funded LLM calls |

Hitting a limit returns `429` with a `Retry-After` header. If a configured
rate-limit backend is unreachable the request is **denied** (`503`,
fail-closed) — an unavailable limiter never becomes unlimited spend.

> **Set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in production.**
> Without them, limits are per server instance and an attacker gets a fresh
> allowance on every cold start.

## Environment variables

Full documentation with every knob is in **`.env.example`**. The essentials:

| Variable | Default | Purpose |
|---|---|---|
| `ALLOW_PLATFORM_KEY` | `false` in production | Whether requests **without** a BYOK key may use the server's key. Keep unset so anonymous traffic can never bill you. |
| `TINYFISH_API_KEY` | — | Server key, used only for BYOK-authenticated requests when platform keys are allowed |
| `GEMINI_API_KEY` | — | Same, for the optional AI summary |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | Distributed rate limiting (required for global limits) |
| `SITESCORE_ACCESS_TOKEN` | — | When set, `POST /api/audit` requires `x-sitescore-token` |
| `KEY_ENCRYPTION_KEYRING` | — | `kid:base64key,...` for AES-256-GCM storage of keys; first entry is active |
| `AUDIT_LOG_ENABLED` | `true` | Structured, hash-chained JSON audit events (no secrets) |

**BYOK + env resolution**: the request-body `tinyfishKey` wins when present.
The server env key is used **only** if `ALLOW_PLATFORM_KEY` permits it — in
production it does not, by default. If neither is available → `400
missing_api_key`. Keys are never echoed in responses or logs; logs record only a
truncated HMAC fingerprint. In the UI, keys live in page memory for the request
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
| 400 `invalid_request` | Malformed JSON or failed validation | Send valid JSON matching `{url, query?, tinyfishKey?, llmKey?, llmProvider?}` |
| 401 `unauthorized` | `SITESCORE_ACCESS_TOKEN` is set but absent/wrong | Send the token in `x-sitescore-token` |
| 413 `invalid_request` | Request body over 16 KB | Shorten the URL/query; keys are not arbitrarily large |
| 429 `rate_limited` | Per-minute/hour/day or global cap reached | Wait for `Retry-After` |
| 429 `concurrency_limit` | Too many audits already running | Wait for the current one to finish |
| 429 `budget_exhausted` | Daily platform budget exhausted | Add your own key, or raise `RATE_LIMIT_GLOBAL_PER_DAY` |
| 503 `server_busy` | Global concurrency cap reached | Retry shortly |
| 503 `rate_limiter_unavailable` | Configured rate-limit backend is down (fail-closed) | Check the Redis credentials |
| 400 `private_host_not_allowed` | Target resolves to localhost / private / link-local / metadata | Use a public URL |
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
