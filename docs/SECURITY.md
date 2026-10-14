# Security Review & Hardening

Audit of the SiteScore BYOK (Bring Your Own Key) codebase, the findings, and
the controls that now enforce them.

**Scope.** Next.js App Router app: one public endpoint (`POST /api/audit`) that
proxies to TinyFish Search + Fetch and optionally Google Gemini.

**Threat model.** The deployment is public and unauthenticated by default. The
assets that matter are (1) the site owner's provider bill and (2) users'
provider keys. Everything below is ordered by the risk of those two being
compromised.

---

## Executive summary

The single most dangerous property of the original code was:

> `POST /api/audit` was completely unauthenticated, had **no rate limiting of
> any kind**, and fell back to the **developer's own `TINYFISH_API_KEY`** when
> the caller did not supply one.

Each request fans out to **4 upstream calls** (2 Fetch + 2 Search) and runs for
up to 120 seconds. That is an unauthenticated, unmetered credit card with the
merchant's name on it. A single `while true` loop was enough to run up an
unbounded bill — exactly the "woke up to an unexpected invoice" scenario.

No hardcoded secrets were found in the repository or its git history. The
BYOK flow itself was already ephemeral and reasonably hygienic; the damage was
entirely in the missing cost and authentication layer around it.

---

## Findings

### CRITICAL

| # | Finding | Where |
|---|---------|-------|
| C1 | **No rate limiting whatsoever.** No per-IP, per-user, per-key, no concurrency cap, no daily ceiling. Unbounded upstream spend. | `app/api/audit/route.ts` (whole handler) |
| C2 | **Platform-key fallback.** Anonymous requests without a BYOK key were served with the server's `TINYFISH_API_KEY`, so strangers billed the developer. Same for `GEMINI_API_KEY`. | `route.ts` (key resolution), `lib/llm.ts:100` |
| C3 | **No authentication.** The endpoint was fully public with no token, session, or proof of anything. | `app/api/audit/route.ts` |
| C4 | **No cost circuit breaker.** Nothing bounded spend per day regardless of how many distinct keys or IPs were used. | — |

### HIGH

| # | Finding | Where |
|---|---------|-------|
| H1 | **Gemini key sent as a URL query parameter** (`?key=...`). Query strings leak into reverse-proxy logs, CDN logs, browser history and referrers. | `lib/llm.ts` |
| H2 | **Error text passed straight through to the client.** Upstream failure messages (which can contain internal hostnames and response fragments) were returned verbatim in production. | `route.ts` `jsonError` |
| H3 | **SSRF blocklist was literal-prefix only.** Bypassable via `127.1`, decimal (`2130706433`), octal (`0177.0.0.1`), IPv6 loopback (`::1`), IPv4-mapped IPv6 (`::ffff:127.0.0.1`), and by any hostname that resolves to a private IP (DNS rebinding). | `route.ts` `isBlockedHost` |
| H4 | **No security headers** — no CSP, no HSTS, no frame-ancestors, `X-Powered-By` exposed. | `next.config.js` |
| H5 | **No audit logging.** No way to attribute spend, detect abuse, or investigate an incident after the fact. | — |

### MEDIUM

| # | Finding | Where |
|---|---------|-------|
| M1 | **Prompt injection.** Attacker-controlled page content (titles, meta descriptions, evidence strings) and the user query were interpolated into the LLM prompt with no delimiting or sanitization. | `lib/llm.ts` `buildPrompt` |
| M2 | **No request body size limit** — the body was parsed before any bound was applied. | `route.ts` |
| M3 | **Generation parameters not centrally capped** and no audit of token usage. | `lib/llm.ts` |
| M4 | **No rate-limit state across serverless instances**, so limits reset on every cold start. | — |
| M5 | **Client-supplied query not length/character sanitized** before use in a shell-like context. | `route.ts` |

### LOW / INFORMATIONAL

| # | Finding |
|---|---------|
| L1 | Dependency posture is clean — `npm audit` reports **0 vulnerabilities**. Patch-level updates available (`next`, `zod`, `motion`). |
| L2 | Keys were already `type="password"` and never persisted to `localStorage` — correct, and preserved. |
| L3 | No agent loop, tool-calling, RAG index or recursive traversal exists in this codebase, so there is no unbounded-recursion or tool-permission surface to harden. The one prompt surface (`lib/agent-prompt.ts`) is a static text generator, not an autonomous agent. |

---

## Controls now in place

### 1. Cost control (the critical fix)

Every request now passes `gateAuditRequest` (`lib/security/gate.ts`) **before any
provider or LLM call is made**. A rejected request costs the developer exactly
zero. The gate runs in this order:

1. **Optional shared-token auth** — `SITESCORE_ACCESS_TOKEN` + `x-sitescore-token`,
   compared in constant time.
2. **Key-source resolution** — BYOK wins; the platform key is only eligible
   when `ALLOW_PLATFORM_KEY` permits it.
3. **Rate limits** — per-minute, per-hour and per-day windows against the
   **key fingerprint** *and* against the **client IP**. Limiting on IP
   separately is deliberate: it stops an attacker rotating keys to multiply
   their allowance.
4. **Concurrency semaphores** — per-identity and global.
5. **Daily budget circuit breakers** — a platform-wide request ceiling and a
   separate LLM-call ceiling.

**Fail-closed everywhere.** If a configured Redis backend is unreachable, the
request is *denied* (`rate_limiter_unavailable`, HTTP 503). An unavailable
limiter must never degrade into unlimited spend.

**Platform keys are off in production by default.** `allowPlatformKey()`
returns `false` when `NODE_ENV=production` unless you explicitly set
`ALLOW_PLATFORM_KEY=true`. A deployment that has `TINYFISH_API_KEY` set but
leaves the default will simply never use it for anonymous callers.

This covers **both** providers. `GEMINI_API_KEY` is subject to the same rule: a
caller who brings their own TinyFish key but omits an LLM key does **not**
silently fall through to the developer's model quota — the route passes an
explicit empty `envKey` so `getAiSummary` cannot reach for the env var. (This
was a real gap found while answering "is it hard BYOK by default?", and is now
covered by two regression tests.)

**"Add nothing" means hard BYOK.** With zero new configuration, in production:
every upstream call is billed to the caller's own key, or refused.

### 2. Key handling

- **No key is ever logged, echoed in a response, or persisted.** Identifiers in
  logs are truncated HMAC-SHA256 fingerprints (`fingerprint()`), not prefixes —
  a prefix of a real key narrows the search space and is itself a leak.
- **AAD-bound AES-256-GCM** (`lib/security/crypto.ts`) for anything stored:
  random 96-bit IV per encryption, 16-byte auth tag, and additional
  authenticated data binding each ciphertext to its record id, so a ciphertext
  cannot be moved between records.
- **Rotation**: the keyring is `kid:key,kid2:key2`. The first entry is active
  for writes; the rest stay readable. Adding a new key at the front rotates
  with zero downtime.
- **Revocation**: delete a `kid`. Everything sealed under it becomes permanently
  undecryptable — a genuine kill switch.
- **Fail closed**: with no `KEY_ENCRYPTION_KEYRING` configured, the store
  *refuses to persist* rather than silently writing plaintext.
- The Gemini key now travels in the **`x-goog-api-key` header**, never a URL.

### 3. SSRF hardening

`lib/security/url-guard.ts` replaces the old prefix check. It parses IPv4
properly (rejecting ambiguous leading-zero/octal forms), blocks all non-public
ranges by CIDR — including CGNAT `100.64/10`, benchmarking `198.18/15`,
multicast and reserved space — handles IPv6 including IPv4-mapped and NAT64
prefixes, rejects URL credentials and control characters, and then **resolves
DNS and re-checks the actual address**. DNS failure fails closed.

### 4. Output and error handling

Client-facing errors pass through a **fixed allow-list**. Anything not
explicitly listed gets a generic message, so a future upstream message cannot
leak by accident. No stack traces reach clients. `Retry-After` is set whenever
a client is expected to back off.

### 5. Prompt injection (M1)

Untrusted page content and the user query are stripped of control characters,
length-capped, and wrapped in explicit `BEGIN/END UNTRUSTED DATA` delimiters
with an instruction that the enclosed data is inert and must not be obeyed. The
model is called single-shot with **no tools, no function calling and no
grounding**, so there is nothing for an injected instruction to invoke. Output
is rendered as plain text by React, so it is not an XSS vector.

### 6. Headers

CSP (`frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self'` — no
wildcard), HSTS with preload, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `poweredByHeader: false`.

### 7. Audit logging and anomaly detection

Structured JSON to stdout, hash-chained (`prev`/`hash`) so deletion or in-place
editing of a record is detectable. Events record user id, key **fingerprint**,
model, token counts, latency, status and upstream call count — never key
material and never full prompts. Every `detail` field passes through `redact()`
before serialization.

Anomaly detection emits `security.anomaly` on an absolute usage spike or a
3x jump versus the previous minute.

> **Honest limitation:** the hash chain raises the cost of tampering; it does
> not make logs immutable. A host-level attacker with write access to stdout can
> still suppress output. For real immutability, ship stdout to an append-only
> sink (CloudWatch with a locked retention policy, Datadog, or a SIEM).

---

## Verification

```bash
npx tsc --noEmit                # strict typecheck
npm run lint
npm run build
npx -y tsx lib/security/selftest.ts   # 37 security assertions
npx -y tsx lib/selftest.ts            # existing engine self-test
```

The security self-test covers SSRF bypass encodings, rate-limit and budget
trips, key rotation/revocation/tamper detection, redaction of every vendor key
format, fingerprint irreversibility, prompt-injection neutralization, and
fail-closed behaviour. It exits non-zero on failure, so it can gate CI.

One real bug was caught by these tests during the work: the concurrency slot was
leaking on early-return error paths, which would have progressively starved the
service until all traffic was refused. It is now released in a `finally` block.

---

## Operational notes

**Before deploying**

1. Keep `ALLOW_PLATFORM_KEY` unset (production default denies it).
2. Set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Without these,
   rate limits are per-instance and an attacker gets a fresh allowance on every
   cold start. With them set, limits are global and the app fails closed if the
   backend is down.
3. Set `SITESCORE_ACCESS_TOKEN` if the app should not be publicly callable.
4. Set `KEY_FINGERPRINT_PEPPER` and `INSTANCE_SALT` to the **same value on
   every instance**, otherwise fingerprints diverge and per-key limits fragment.
5. If you must serve anonymous users with your own key, set
   `ALLOW_PLATFORM_KEY=true` **and** verify `RATE_LIMIT_GLOBAL_PER_DAY` matches
   what you are willing to pay for. Set `LLM_PLATFORM_KEY_PER_DAY=0` to disable
   platform-funded LLM calls entirely.

**Alerting.** Watch for `security.anomaly` events and a rising
`rate_limited` rate. A sudden jump in `budget_exhausted` means someone is
attacking your budget.

**Rotation.** Provider keys should be rotated on a schedule and immediately if
they ever appear in a log, a screenshot, or a commit. Deleting a `kid` from
`KEY_ENCRYPTION_KEYRING` revokes all data sealed under it.

**Known limitations, stated plainly.**

- Without the Redis backend, rate limits are per-instance, not global.
- The hash-chained audit log detects tampering but is not a WORM store.
- CSP uses `'unsafe-inline'` for scripts because Next.js App Router injects
  inline bootstrap. Moving to nonce-based CSP is the next hardening step.
- There is no per-account identity system, because there are no accounts; the
  identity model is deliberately "key fingerprint, else IP hash".