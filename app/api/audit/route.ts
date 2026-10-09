import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as cheerio from "cheerio";
import { runAuditEngine } from "@/lib/engine";
import { getAiSummary } from "@/lib/llm";
import { gateAuditRequest, mayExposeUpstreamDetail } from "@/lib/security/gate";
import { validateAuditUrl } from "@/lib/security/url-guard";
import { auditLog, recordUsage } from "@/lib/security/audit-log";
import { redact } from "@/lib/security/redact";
import { securityConfig, allowPlatformKey } from "@/lib/security/config";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/audit - server-side proxy to TinyFish Search + Fetch.
// Two-phase: (A) parallel Fetch HTML + Fetch Markdown, then derive the target
// query if the caller did not supply one; (B) parallel Search indexation +
// Search ranking. Live pages only: every Fetch body sends `ttl: 0`.
// ---------------------------------------------------------------------------

const FETCH_API = "https://api.fetch.tinyfish.ai";
const SEARCH_API = "https://api.search.tinyfish.ai";
const FETCH_TIMEOUT_MS = 130_000;
const SEARCH_TIMEOUT_MS = 30_000;
const TINYFISH_KEYS_URL = "https://agent.tinyfish.ai/api-keys";

/** Hard ceiling on the JSON request body (bytes). Rejects oversized payloads. */
const MAX_BODY_BYTES = 16 * 1024;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Generation/usage parameters are server-owned. The client may request the
 * LLM summary but can NEVER influence model, temperature or token budgets.
 */
const BodySchema = z
  .object({
    url: z
      .string()
      .min(1, "url is required")
      .max(2000, "url must be at most 2000 characters"),
    query: z
      .string()
      .max(300)
      .optional()
      .nullable()
      // Strip control characters; prompt-injection vectors are neutralized later.
      .transform((v) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "") : v)),
    tinyfishKey: z.string().min(8).max(2000).optional().nullable(),
    llmKey: z.string().min(8).max(2000).optional().nullable(),
    llmProvider: z.enum(["gemini", "none"]).optional().nullable(),
  })
  .strict();

// --- Upstream shapes (subset of the TinyFish contracts) ---------------------

interface FetchResultItem {
  url?: string;
  final_url?: string;
  title?: string;
  description?: string;
  language?: string;
  author?: string;
  published_date?: string;
  text?: string;
  links?: unknown;
  image_links?: unknown;
  latency_ms?: number;
  format?: string;
}

interface FetchErrorItem {
  url?: string;
  error?: string;
  code?: string;
  message?: string;
  status?: number;
}

interface FetchUpstream {
  results?: FetchResultItem[];
  errors?: FetchErrorItem[];
}

interface SearchResultItem {
  position?: number;
  site_name?: string;
  title?: string;
  snippet?: string;
  url?: string;
}

interface SearchUpstream {
  query?: string;
  results?: SearchResultItem[];
  total_results?: number;
  page?: number;
  error?: string;
}

// --- Response shapes (internal contract from tasks.md) ----------------------

type CheckStatus = "pass" | "warn" | "fail";
type CheckCategory = "readability" | "visibility" | "technical";

interface Check {
  id: string;
  category: CheckCategory;
  status: CheckStatus;
  label: string;
  detail: string;
  evidence: string;
}

interface Fix {
  priority: "P0" | "P1" | "P2";
  title: string;
  why: string;
  how: string;
  codeBefore: string;
  codeAfter: string;
}

class UpstreamError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

// --- Small helpers ----------------------------------------------------------

/**
 * Build a client-facing error response.
 *
 * In production the upstream message is replaced with a generic, safe copy so
 * internal hosts, stack fragments and provider internals never reach a
 * browser. Retry-After is set whenever the client is expected to back off.
 */
function jsonError(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
) {
  const expose = mayExposeUpstreamDetail();
  const headers: Record<string, string> = { ...NO_STORE };
  const retryAfter =
    typeof extra?.retryAfterSec === "number" ? extra.retryAfterSec : undefined;
  if (typeof retryAfter === "number" && retryAfter > 0) {
    headers["Retry-After"] = String(Math.min(Math.ceil(retryAfter), 86_400));
  }
  const body: Record<string, unknown> = expose
    ? { error, message, ...extra }
    : {
        error,
        message: sanitizeClientMessage(error, status),
        retryable: extra?.retryable === true,
      };
  return NextResponse.json(body, { status, headers });
}

/**
 * Map an internal error code to a fixed, safe, human-readable message.
 * Allow-listed codes keep their (already safe, author-written) text; anything
 * else falls back to a generic message. This is a hard allow-list, so a new
 * upstream message can never leak by accident.
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "The request body was invalid.",
  invalid_url: "Invalid URL. Provide an http(s) URL, e.g. https://example.com/page.",
  private_host_not_allowed:
    "Audits of localhost, private-network and cloud-metadata addresses are not allowed.",
  missing_api_key:
    "A TinyFish API key is required. Add your own key under Settings → API keys.",
  invalid_api_key: "The TinyFish API key was rejected. Check the key and try again.",
  rate_limited: "Rate limit reached. Please wait before running another audit.",
  concurrency_limit: "Too many audits running at once. Wait for the current one to finish.",
  server_busy: "The service is busy. Please retry shortly.",
  budget_exhausted:
    "The daily usage budget is exhausted. Add your own API key to continue.",
  rate_limiter_unavailable: "The request could not be admitted. Please retry shortly.",
  unauthorized: "A valid access token is required.",
  upstream_timeout: "The upstream fetch timed out. The target page may be slow.",
  tinyfish_unavailable: "The upstream provider is unavailable. Please retry shortly.",
  internal_error: "Unexpected server error while running the audit.",
};

function sanitizeClientMessage(code: string, status: number): string {
  const safe = SAFE_ERROR_MESSAGES[code];
  if (safe) return safe;
  if (status === 429) return SAFE_ERROR_MESSAGES.rate_limited;
  if (status === 503) return SAFE_ERROR_MESSAGES.server_busy;
  return SAFE_ERROR_MESSAGES.internal_error;
}

/**
 * Upstream failure text for the audit log: always redacted, never returned.
 */
function detailOf(e: unknown): string {
  return redact(e, 300);
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Canonical page identity for comparing input/final/search-result URLs.
 * NOTE: SSRF validation now lives in lib/security/url-guard.ts, which also
 * resolves DNS and checks the resulting address. Do not reintroduce a
 * literal-only blocklist here.
 */
function canonUrl(u: string): string | null {
  try {
    const p = new URL(u.trim());
    const host = p.hostname.toLowerCase().replace(/^www\./, "");
    const path = p.pathname.replace(/\/+$/, "");
    return `${p.protocol}//${host}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

function urlsEqual(a: string, b: string): boolean {
  const ca = canonUrl(a);
  const cb = canonUrl(b);
  return ca !== null && ca === cb;
}

function countWords(text: string): number {
  const n = text.split(/\s+/).filter(Boolean).length;
  return Number.isFinite(n) ? n : 0;
}

function countLinks(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v !== null && typeof v === "object") return Object.keys(v).length;
  return 0;
}

function excerpt(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** Strip " | Site", " - Brand", ": Section" style suffixes for query derivation. */
function stripSiteSuffix(title: string): string {
  const parts = title.split(/\s+[|｜:·•]\s+|\s+[-–—]\s+/);
  const first = (parts[0] ?? title).trim();
  return first || title.trim();
}

function deriveQuery(args: {
  userQuery: string;
  title: string;
  h1: string;
  metaDesc: string;
  hostname: string;
}): { query: string; querySource: "user" | "auto" } {
  if (args.userQuery.trim().length > 0) {
    return { query: args.userQuery.trim().slice(0, 120), querySource: "user" };
  }
  const candidates = [
    stripSiteSuffix(args.title),
    args.h1.trim(),
    args.metaDesc.trim().split(/\s+/).slice(0, 8).join(" "),
    args.hostname.replace(/^www\./, ""),
  ];
  for (const c of candidates) {
    if (c && c.length > 0) return { query: c.slice(0, 120), querySource: "auto" };
  }
  return { query: args.hostname.replace(/^www\./, ""), querySource: "auto" };
}

function fetchErrorCode(e: FetchErrorItem): string {
  const raw = String(e.error ?? e.code ?? e.message ?? "fetch_error");
  const first = raw.split(/[:\s]/)[0] ?? raw;
  const cleaned = first.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return cleaned || "fetch_error";
}

/** Coerce TinyFish `image_links` (string[] | object[] | map) to string[]. */
function toStringList(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === "string" && item) out.push(item);
      else if (item !== null && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        for (const k of ["src", "url", "href"]) {
          if (typeof rec[k] === "string" && (rec[k] as string)) {
            out.push(rec[k] as string);
            break;
          }
        }
      }
    }
    return out;
  }
  if (v !== null && typeof v === "object") {
    return Object.values(v).filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
  }
  return [];
}

// --- TinyFish clients -------------------------------------------------------

async function tinyfishFetch(
  url: string,
  format: "html" | "markdown",
  key: string
): Promise<FetchUpstream> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      FETCH_API,
      {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json" },
        // ttl: 0 forces a live fetch (PRD req #5) - never serve a saved copy.
        body: JSON.stringify({
          urls: [url],
          format,
          links: true,
          image_links: true,
          ttl: 0,
          per_url_timeout_ms: 100_000,
        }),
      },
      FETCH_TIMEOUT_MS
    );
  } catch (e) {
    if (isAbort(e)) {
      throw new UpstreamError(504, "upstream_timeout", "TinyFish Fetch timed out.", true);
    }
    throw new UpstreamError(502, "tinyfish_unavailable", `TinyFish Fetch unreachable: ${messageOf(e)}`, true);
  }
  if (res.status === 401 || res.status === 403) {
    throw new UpstreamError(401, "invalid_api_key", "TinyFish rejected the API key (HTTP 401). Check the key and try again.", false);
  }
  if (res.status === 429) {
    throw new UpstreamError(429, "rate_limited", "TinyFish rate limit reached. Wait a moment and retry.", true);
  }
  if (res.status >= 500) {
    throw new UpstreamError(502, "tinyfish_unavailable", `TinyFish Fetch failed with HTTP ${res.status}.`, true);
  }
  if (!res.ok) {
    throw new UpstreamError(res.status, "fetch_rejected", `TinyFish Fetch rejected the request (HTTP ${res.status}).`, false);
  }
  return (await res.json()) as FetchUpstream;
}

async function tinyfishSearch(
  params: Record<string, string>,
  key: string
): Promise<SearchUpstream> {
  const qs = new URLSearchParams(params);
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${SEARCH_API}?${qs.toString()}`,
      { method: "GET", headers: { "X-API-Key": key } },
      SEARCH_TIMEOUT_MS
    );
  } catch (e) {
    if (isAbort(e)) {
      throw new UpstreamError(504, "upstream_timeout", "TinyFish Search timed out.", true);
    }
    throw new UpstreamError(502, "tinyfish_unavailable", `TinyFish Search unreachable: ${messageOf(e)}`, true);
  }
  if (res.status === 401 || res.status === 403) {
    throw new UpstreamError(401, "invalid_api_key", "TinyFish rejected the API key (HTTP 401).", false);
  }
  if (res.status === 429) {
    throw new UpstreamError(429, "rate_limited", "TinyFish Search rate limit reached.", true);
  }
  if (!res.ok) {
    throw new UpstreamError(res.status, "search_failed", `TinyFish Search failed with HTTP ${res.status}.`, res.status >= 500);
  }
  return (await res.json()) as SearchUpstream;
}

// --- Handler ----------------------------------------------------------------

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const cfg = securityConfig();

  // ---- 0. Reject oversized bodies before reading them into memory --------
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "invalid_request", "Request body is too large.");
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError(413, "invalid_request", "Request body is too large.");
    }
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON.");
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid request body.");
  }

  const bodyKey = (parsed.data.tinyfishKey ?? "").trim();
  const wantsLlm = parsed.data.llmProvider === "gemini";

  // ---- 1. Pre-flight gate: auth, rate limits, concurrency, budgets -------
  // Every rejection below happens BEFORE any provider or LLM call, so a
  // blocked request costs the developer nothing.
  const gate = await gateAuditRequest({ req, byokKey: bodyKey || null, wantsLlm });
  if (!gate.ok) {
    return jsonError(gate.status, gate.code, gate.message, {
      retryable: gate.status === 429 || gate.status === 503,
      retryAfterSec: gate.retryAfterSec,
    });
  }
  const { identity } = gate;

  let gateReleased = false;
  const release = async () => {
    if (gateReleased) return;
    gateReleased = true;
    await gate.release();
  };

  try {
    // ---- 2. Normalize + validate URL (SSRF-hardened, DNS-resolved) -------
    const urlCheck = await validateAuditUrl(parsed.data.url);
    if (!urlCheck.ok) {
      const code =
        urlCheck.reason === "blocked_host" || urlCheck.reason === "dns_blocked"
          ? "private_host_not_allowed"
          : "invalid_url";
      auditLog({
        event: "audit.failed",
        requestId: identity.requestId,
        actorId: identity.actorId,
        keyId: identity.keyId,
        keySource: identity.keySource,
        status: code,
        detail: `url_rejected:${urlCheck.reason}`,
      });
      return jsonError(400, code, urlCheck.message);
    }
    const normalizedUrl = urlCheck.url;
    const hostname = urlCheck.hostname;

    // ---- 3. Resolve the provider key. BYOK wins; the platform fallback is
    //         already gated above. The key is never echoed or logged. ------
    const envKey = (process.env.TINYFISH_API_KEY ?? "").trim();
    const apiKey = bodyKey || envKey;
    if (!apiKey) {
      return jsonError(400, "missing_api_key", "A TinyFish API key is required.", {
        docs: TINYFISH_KEYS_URL,
      });
    }

    const userQuery = (parsed.data.query ?? "").trim();

    auditLog({
      event: "audit.started",
      requestId: identity.requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource: identity.keySource,
      targetHost: hostname,
    });
    recordUsage({ actorId: identity.actorId, keyId: identity.keyId });

    /**
     * Hard ceiling on metered upstream calls for this single audit.
     *
     * The current flow is structurally fixed at 4 calls (2 Fetch + 2 Search),
     * so this is defence in depth: if someone later adds a retry loop, a
     * pagination loop or an extra search, this fails the audit loudly instead
     * of quietly multiplying spend per request.
     */
    let upstreamCalls = 0;
    const spendUpstream = async <T>(fn: () => Promise<T>): Promise<T> => {
      upstreamCalls += 1;
      if (upstreamCalls > cfg.cost.maxUpstreamCallsPerAudit) {
        throw new UpstreamError(
          502,
          "tinyfish_unavailable",
          "Upstream call budget for this audit exceeded.",
          false
        );
      }
      return fn();
    };

    // ---- Phase A: parallel live fetches (HTML + Markdown) ------------------
    const [htmlSettled, mdSettled] = await Promise.allSettled([
      spendUpstream(() => tinyfishFetch(normalizedUrl, "html", apiKey)),
      spendUpstream(() => tinyfishFetch(normalizedUrl, "markdown", apiKey)),
    ]);

    const fetchErrors: Array<{ url: string; error: string; status?: number }> = [];

    const absorb = (
      settled: PromiseSettledResult<FetchUpstream>,
      format: "html" | "markdown"
    ): { item: FetchResultItem | null; failure: UpstreamError | null } => {
      if (settled.status === "fulfilled") {
        const first = settled.value.results?.[0] ?? null;
        for (const e of settled.value.errors ?? []) {
          fetchErrors.push({
            url: e.url ?? normalizedUrl,
            error: String(e.error ?? e.code ?? e.message ?? "fetch_error"),
            ...(typeof e.status === "number" ? { status: e.status } : {}),
          });
        }
        return { item: first, failure: null };
      }
      const reason = settled.reason as unknown;
      if (reason instanceof UpstreamError) {
        fetchErrors.push({ url: normalizedUrl, error: `${reason.code}: ${reason.message}` });
        return { item: null, failure: reason };
      }
      fetchErrors.push({ url: normalizedUrl, error: `fetch_${format}_failed: ${messageOf(reason)}` });
      return {
        item: null,
        failure: new UpstreamError(502, "tinyfish_unavailable", messageOf(reason), true),
      };
    };
    const htmlAbsorbed = absorb(htmlSettled, "html");
    const mdAbsorbed = absorb(mdSettled, "markdown");
    const htmlItem: FetchResultItem | null = htmlAbsorbed.item;
    const mdItem: FetchResultItem | null = mdAbsorbed.item;
    const transportFailure: UpstreamError | null =
      htmlAbsorbed.failure ?? mdAbsorbed.failure;

    const hasData = htmlItem !== null || mdItem !== null;
    if (!hasData && fetchErrors.length === 0) {
      // Should not happen, but never return an empty 200.
      throw new UpstreamError(502, "tinyfish_unavailable", "TinyFish Fetch returned no data.", true);
    }
    if (!hasData && transportFailure) {
      const t = transportFailure;
      // Log the failure even though we return early - the concurrency slot is
      // released by the outer `finally`.
      auditLog({
        event: "audit.failed",
        requestId: identity.requestId,
        actorId: identity.actorId,
        keyId: identity.keyId,
        keySource: identity.keySource,
        status: t.code,
        latencyMs: Date.now() - startedAt,
        upstreamCalls,
        targetHost: hostname,
        detail: detailOf(t.message),
      });
      if (t.code === "invalid_api_key") {
        return jsonError(401, "invalid_api_key", t.message, { retryable: false });
      }
      if (t.code === "rate_limited") {
        return jsonError(429, "rate_limited", t.message, {
          retryable: true,
          retryAfterSec: 60,
        });
      }
      if (t.retryable) {
        return jsonError(t.status, t.code, t.message, { retryable: true });
      }
      return jsonError(t.status, t.code, t.message, { retryable: false });
    }

    // ---- Extract page signals ---------------------------------------------
    const finalUrl = htmlItem?.final_url || mdItem?.final_url || normalizedUrl;
    const redirected = !urlsEqual(normalizedUrl, finalUrl);

    let h1 = "";
    let metaDesc = "";
    if (htmlItem?.text) {
      try {
        const $ = cheerio.load(htmlItem.text);
        h1 = $("h1").first().text().trim().slice(0, 200);
        metaDesc =
          $('meta[name="description"]').attr("content")?.trim() ??
          $('meta[property="og:description"]').attr("content")?.trim() ??
          "";
      } catch {
        // Cheerio parse is best-effort; fall back to API fields below.
      }
    }

    const pageTitle = (htmlItem?.title || mdItem?.title || "").trim();
    const description = (metaDesc || htmlItem?.description || mdItem?.description || "").trim();
    const mdText = mdItem?.text ?? "";
    const htmlText = htmlItem?.text ?? "";
    const wordCount = mdText ? countWords(mdText) : 0;
    const htmlLen = htmlText.length;
    const mdLen = mdText.length;
    const latencies = [htmlItem?.latency_ms, mdItem?.latency_ms].filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n)
    );
    const latencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
    const linkCount = countLinks(htmlItem?.links ?? mdItem?.links);
    const imageLinkCount = countLinks(htmlItem?.image_links ?? mdItem?.image_links);

    // ---- Derive query when the caller did not supply one -------------------
    const { query: resolvedQuery, querySource } = deriveQuery({
      userQuery,
      title: pageTitle,
      h1,
      metaDesc: description,
      hostname,
    });

    // ---- Phase B: parallel searches (indexation + ranking) ------------------
    const pathSegs = (() => {
      try {
        return new URL(normalizedUrl).pathname.split("/").filter(Boolean);
      } catch {
        return [];
      }
    })();
    const slug = (pathSegs.length > 0 ? pathSegs[pathSegs.length - 1] : "") ?? "";
    let slugWords = "";
    try {
      slugWords = decodeURIComponent(slug).replace(/[-_+]+/g, " ").trim().slice(0, 60);
    } catch {
      slugWords = slug.replace(/[-_+]+/g, " ").trim().slice(0, 60);
    }
    const indexationQuery = slugWords ? `site:${hostname} "${slugWords}"` : `site:${hostname}`;
    const rankingQuery = resolvedQuery;

    const [idxSettled, rankSettled] = await Promise.allSettled([
      spendUpstream(() => tinyfishSearch({ query: indexationQuery, include_domains: hostname }, apiKey)),
      spendUpstream(() => tinyfishSearch({ query: rankingQuery }, apiKey)),
    ]);

    const idxData: SearchUpstream | null =
      idxSettled.status === "fulfilled" ? idxSettled.value : null;
    const idxError: UpstreamError | null =
      idxSettled.status === "rejected" && idxSettled.reason instanceof UpstreamError
        ? (idxSettled.reason as UpstreamError)
        : idxSettled.status === "rejected"
          ? new UpstreamError(502, "search_failed", messageOf(idxSettled.reason), true)
          : null;
    const rankData: SearchUpstream | null =
      rankSettled.status === "fulfilled" ? rankSettled.value : null;
    const rankError: UpstreamError | null =
      rankSettled.status === "rejected" && rankSettled.reason instanceof UpstreamError
        ? (rankSettled.reason as UpstreamError)
        : rankSettled.status === "rejected"
          ? new UpstreamError(502, "search_failed", messageOf(rankSettled.reason), true)
          : null;

    const idxResults = idxData?.results ?? [];
    const rankResults = rankData?.results ?? [];

    const idxMatch =
      idxResults.find((r) => r.url && (urlsEqual(r.url, normalizedUrl) || urlsEqual(r.url, finalUrl))) ?? null;
    const indexed = idxMatch !== null;
    const rankMatch =
      rankResults.find((r) => r.url && (urlsEqual(r.url, normalizedUrl) || urlsEqual(r.url, finalUrl))) ?? null;
    const rank = typeof rankMatch?.position === "number" ? rankMatch.position : null;

    const competitors = rankResults
      .filter((r) => {
        if (!r.url) return false;
        try {
          const h = new URL(r.url).hostname.toLowerCase().replace(/^www\./, "");
          return h !== hostname.toLowerCase().replace(/^www\./, "");
        } catch {
          return false;
        }
      })
      .slice(0, 5)
      .map((r) => ({
        position: r.position ?? null,
        siteName: r.site_name ?? "",
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: (r.snippet ?? "").slice(0, 200),
      }));

    // ---- Audit engine (lib/, Task 3) ----------------------------------------
    // Fetch/search orchestration above stays intact; scoring, checks, fixes and
    // the readability -> visibility narrative come from the deterministic engine.
    const fetchedAt = new Date().toISOString();
    const errCodes = fetchErrors.map(fetchErrorCode);

    const engineSiteResults = idxResults
      .filter((r) => typeof r.url === "string" && (r.url as string).length > 0)
      .map((r) => ({
        url: r.url as string,
        title: r.title,
        snippet: r.snippet,
        position: r.position,
        site_name: r.site_name,
      }));
    const engineRankingResults = rankResults
      .filter((r) => typeof r.url === "string" && (r.url as string).length > 0)
      .map((r) => ({
        url: r.url as string,
        title: r.title,
        snippet: r.snippet,
        position: r.position,
        site_name: r.site_name,
      }));

    const engine = runAuditEngine({
      url: normalizedUrl,
      finalUrl,
      html: htmlText,
      markdownText: mdText,
      imageLinks: toStringList(htmlItem?.image_links ?? mdItem?.image_links),
      latencyMs,
      author: htmlItem?.author ?? mdItem?.author ?? null,
      publishedDate: htmlItem?.published_date ?? mdItem?.published_date ?? null,
      query: userQuery,
      siteResults: engineSiteResults,
      rankingResults: engineRankingResults,
      fetchError: errCodes.length > 0 ? errCodes.join(" ") : null,
    });
    // Engine-derived query is canonical for the report. In practice it matches
    // the route-derived query used for the ranking probe above (same page
    // signals); the probe query is preserved in raw.searchQueries.
    const engineQuery = engine.query || resolvedQuery;
    const engineQuerySource = engine.query ? engine.querySource : querySource;

    const checks: Check[] = [...engine.checks];
    const fixes: Fix[] = [...engine.fixes];

    for (const code of ["bot_blocked", "login_required", "empty_content", "timeout", "page_not_found"]) {
      if (!errCodes.includes(code)) continue;
      if (code === "bot_blocked") {
        checks.push({
          id: "fetch_error_bot_blocked",
          category: "technical",
          status: "fail",
          label: "Fetch blocked by bot protection",
          detail: "The server treated the fetch crawler as a bot. AI assistants hitting the same wall cannot read or cite this page.",
          evidence: fetchErrors.filter((e) => fetchErrorCode(e) === code).map((e) => e.error).join(" | "),
        });
        fixes.push({
          priority: "P0",
          title: "Allow well-behaved AI fetchers through bot protection",
          why: `TinyFish Fetch reported "bot_blocked" for ${finalUrl}; the same block stops AI search assistants from reading the page.`,
          how: "Allowlist fetch/assistant crawler user-agents and verify in robots.txt that the page path is allowed; keep rate-limiting for abuse but exempt single-page reads, then re-audit.",
          codeBefore: "User-agent: *\nDisallow: /",
          codeAfter: "User-agent: *\nAllow: /",
        });
      } else if (code === "login_required") {
        checks.push({
          id: "fetch_error_login_required",
          category: "technical",
          status: "fail",
          label: "Page requires login",
          detail: "Fetch hit a sign-in wall, so anonymous AI tools (and logged-out searchers) see no content.",
          evidence: fetchErrors.filter((e) => fetchErrorCode(e) === code).map((e) => e.error).join(" | "),
        });
        fixes.push({
          priority: "P0",
          title: "Expose a public, indexable version of the content",
          why: `TinyFish Fetch reported "login_required" for ${finalUrl}; anything behind the wall is invisible to AI search.`,
          how: "Publish the key content on a public URL (or add metering/first-click-free), keep the app behind login, then re-audit the public URL.",
          codeBefore: "HTTP 200 + login form HTML for anonymous fetch",
          codeAfter: "HTTP 200 + article HTML with full text for anonymous fetch",
        });
      } else if (code === "empty_content") {
        checks.push({
          id: "fetch_error_empty_content",
          category: "readability",
          status: "fail",
          label: "Page returned empty content",
          detail: "The fetch succeeded but the extractor found nothing to read - likely a thin or script-only page.",
          evidence: fetchErrors.filter((e) => fetchErrorCode(e) === code).map((e) => e.error).join(" | "),
        });
        fixes.push({
          priority: "P0",
          title: "Ship the core content in static HTML",
          why: `TinyFish Fetch reported "empty_content" for ${finalUrl} (${wordCount} words extracted).`,
          how: "Server-render the main article/body text into the HTML response instead of building it only in client JS, then re-audit.",
          codeBefore: '<div id="app"><!-- rendered by JS --></div>',
          codeAfter: "<article><h1>…</h1><p>Full text in the HTML…</p></article>",
        });
      } else if (code === "timeout") {
        checks.push({
          id: "fetch_error_timeout",
          category: "technical",
          status: "fail",
          label: "Fetch timed out",
          detail: "The page took too long to respond, so AI tools may give up before reading it.",
          evidence: fetchErrors.filter((e) => fetchErrorCode(e) === code).map((e) => e.error).join(" | "),
        });
        fixes.push({
          priority: "P1",
          title: "Bring server response time under control",
          why: `TinyFish Fetch reported "timeout" for ${finalUrl}; slow pages get abandoned by crawlers and readers alike.`,
          how: "Cut server response (TTFB) under ~1s: cache the page, defer heavy third-party scripts, then re-audit and compare latencyMs.",
          codeBefore: "TTFB: timeout on fetch",
          codeAfter: "TTFB < 1s, fetch latencyMs < 4000",
        });
      } else {
        checks.push({
          id: "fetch_error_page_not_found",
          category: "technical",
          status: "fail",
          label: "Page not found on fetch",
          detail: "Fetch could not find the page at this URL.",
          evidence: fetchErrors.filter((e) => fetchErrorCode(e) === code).map((e) => e.error).join(" | "),
        });
        fixes.push({
          priority: "P0",
          title: "Fix the URL or restore the page",
          why: `TinyFish Fetch reported "page_not_found" for ${normalizedUrl}.`,
          how: "Check for typos, restore the page, or 301-redirect the URL to its replacement, then re-audit.",
          codeBefore: normalizedUrl,
          codeAfter: finalUrl !== normalizedUrl ? finalUrl : `${normalizedUrl} (HTTP 200 with content)`,
        });
      }
    }

    // Title / meta / word-count / indexation / ranking checks come from the
    // audit engine above (engine.checks); only fetch-error specifics are
    // appended inline below.

    // ---- Connection narrative comes from the engine (readability -> visibility)
    const summary = engine.connection.summary;
    const correlation = engine.connection.correlation;

    // ---- Optional LLM summary (server-only; never fails the audit) --------
    // A BYOK LLM key is preferred; otherwise the server LLM key may be used,
    // but ONLY when platform keys are explicitly enabled (see gate.ts) and
    // only within the LLM daily budget checked up front.
    const llmKeySource = (parsed.data.llmKey ?? "").trim()
      ? "byok"
      : (process.env.GEMINI_API_KEY ?? "").trim() && identity.keySource === "platform"
        ? "platform"
        : "none";
    const aiSummary = await getAiSummary(
      {
        checks,
        fixes,
        scores: {
          total: engine.scores.total,
          readability: engine.scores.readability,
          visibility: engine.scores.visibility,
          technical: engine.scores.technical,
        },
        input: { url: normalizedUrl, finalUrl, query: resolvedQuery },
      },
      {
        llmKey: parsed.data.llmKey,
        llmProvider: parsed.data.llmProvider,
        /**
         * The platform LLM key is opt-in under exactly the same rules as the
         * platform TinyFish key. Passing "" explicitly (rather than undefined)
         * stops `getAiSummary` from reaching for GEMINI_API_KEY, so a caller
         * who supplied their own TinyFish key but no LLM key cannot silently
         * spend the developer's model quota.
         */
        envKey: allowPlatformKey() ? undefined : "",
        // Server-owned generation budget. The client cannot influence these.
        maxOutputTokens: cfg.cost.llmMaxOutputTokens,
        maxPromptChars: cfg.cost.llmMaxPromptChars,
        timeoutMs: Math.min(
          cfg.cost.maxAuditDurationMs - (Date.now() - startedAt),
          25_000
        ),
      }
    );

    if (wantsLlm) {
      auditLog({
        event: "llm.call",
        requestId: identity.requestId,
        actorId: identity.actorId,
        keyId: identity.keyId,
        keySource: identity.keySource,
        model: "gemini-2.0-flash",
        status: aiSummary.generated ? "ok" : "skipped",
        totalTokens: aiSummary.usage?.totalTokens,
        promptTokens: aiSummary.usage?.promptTokens,
        outputTokens: aiSummary.usage?.outputTokens,
        detail: llmKeySource === "none" ? "no_llm_key_available" : aiSummary.warning,
      });
    }

    auditLog({
      event: "audit.completed",
      requestId: identity.requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource: identity.keySource,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      upstreamCalls,
      targetHost: hostname,
    });

    // ---- Assemble contract response --------------------------------------
    return NextResponse.json(
      {
        input: {
          url: normalizedUrl,
          finalUrl,
          query: engineQuery,
          querySource: engineQuerySource,
          fetchedAt,
        },
        score: {
          total: engine.scores.total,
          readability: engine.scores.readability,
          visibility: engine.scores.visibility,
          technical: engine.scores.technical,
          grade: engine.scores.grade,
        },
        fetch: {
          html: htmlItem
            ? {
                url: normalizedUrl,
                finalUrl,
                title: pageTitle,
                description,
                language: htmlItem.language ?? "",
                author: htmlItem.author ?? "",
                publishedDate: htmlItem.published_date ?? "",
                textLength: htmlLen,
                excerpt: excerpt(htmlText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "), 500),
                linkCount,
                imageLinkCount,
                latencyMs: htmlItem.latency_ms ?? 0,
                h1,
              }
            : { url: normalizedUrl, error: "no html fetch result" },
          markdown: mdItem
            ? {
                url: normalizedUrl,
                finalUrl,
                wordCount,
                textLength: mdLen,
                excerpt: excerpt(mdText, 4000),
                latencyMs: mdItem.latency_ms ?? 0,
              }
            : { url: normalizedUrl, wordCount: 0, error: "no markdown fetch result" },
          redirected,
          wordCount,
          latencyMs,
        },
        search: {
          indexation: idxData
            ? {
                query: indexationQuery,
                indexed,
                matchUrl: idxMatch?.url ?? null,
                totalResults: idxData.total_results ?? idxResults.length,
                results: idxResults.slice(0, 5).map((r) => ({
                  position: r.position ?? null,
                  siteName: r.site_name ?? "",
                  title: r.title ?? "",
                  url: r.url ?? "",
                  snippet: (r.snippet ?? "").slice(0, 200),
                })),
              }
            : {
                query: indexationQuery,
                indexed: false,
                matchUrl: null,
                totalResults: 0,
                results: [],
                error: idxError?.code ?? "search_failed",
              },
          ranking: rankData
            ? {
                query: rankingQuery,
                rank,
                totalResults: rankData.total_results ?? rankResults.length,
                results: rankResults.slice(0, 10).map((r) => ({
                  position: r.position ?? null,
                  siteName: r.site_name ?? "",
                  title: r.title ?? "",
                  url: r.url ?? "",
                  snippet: (r.snippet ?? "").slice(0, 200),
                })),
              }
            : {
                query: rankingQuery,
                rank: null,
                totalResults: 0,
                results: [],
                error: rankError?.code ?? "search_failed",
              },
          competitors,
        },
        checks,
        fixes,
        connection: { summary, correlation },
        aiSummary,
        raw: {
          searchQueries: [indexationQuery, rankingQuery],
          fetchErrors,
        },
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (e) {
    if (e instanceof UpstreamError) {
      auditLog({
        event: "audit.failed",
        requestId: identity.requestId,
        actorId: identity.actorId,
        keyId: identity.keyId,
        keySource: identity.keySource,
        status: e.code,
        latencyMs: Date.now() - startedAt,
        // Redacted: may contain upstream hostnames or response fragments.
        detail: detailOf(e.message),
      });
      return jsonError(e.status, e.code, e.message, {
        retryable: e.retryable,
        retryAfterSec: e.status === 429 ? 60 : undefined,
      });
    }
    auditLog({
      event: "audit.failed",
      requestId: identity.requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource: identity.keySource,
      status: "internal_error",
      latencyMs: Date.now() - startedAt,
      detail: detailOf(e),
    });
    // Never surface stack traces or internal error text to the client.
    return jsonError(500, "internal_error", "Unexpected server error while running the audit.", {
      retryable: false,
    });
  } finally {
    // CRITICAL: the concurrency slot must be returned on EVERY exit path -
    // success, error, and the early returns inside the try block. Leaking a
    // slot would permanently shrink capacity until all traffic is refused.
    await release();
  }
}
