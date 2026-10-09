/**
 * The request gate: identity extraction + auth + every pre-flight cost check,
 * executed BEFORE any upstream provider or LLM call.
 *
 * Order matters. The cheapest rejections run first and nothing here can make a
 * network call to a provider, so a rejected request costs the developer zero.
 */

import type { NextRequest } from "next/server";
import { allowPlatformKey, securityConfig, isProduction } from "./config";
import { fingerprint, newRequestId, safeEqual } from "./redact";
import { checkBudget, checkRateLimit, type RateDecision } from "./rate-limit";
import { auditLog } from "./audit-log";

export interface CallerIdentity {
  requestId: string;
  /** Strongest available stable id: key fingerprint when BYOK, else IP hash. */
  actorId: string;
  ipIdentity: string;
  /** Raw client IP. Kept in-memory only; not written to logs in production. */
  ip: string;
  keySource: "byok" | "platform" | "none";
  keyId: string;
  /** Never log the key itself. */
  hasByokKey: boolean;
  byokFingerprint: string;
}

export type GateRejection =
  | "unauthorized"
  | "rate_limited"
  | "concurrency_limit"
  | "server_busy"
  | "budget_exhausted"
  | "rate_limiter_unavailable"
  | "missing_api_key";

export interface GateFailure {
  ok: false;
  status: number;
  code: GateRejection;
  message: string;
  retryAfterSec: number;
  identity: CallerIdentity;
}

export interface GateSuccess {
  ok: true;
  identity: CallerIdentity;
  release: () => Promise<void>;
}

export type GateResult = GateSuccess | GateFailure;

/** Trusted proxy header. Only honored when explicitly configured. */
function trustedProxyHeader(): string | null {
  const h = securityConfig();
  void h;
  const configured = process.env.TRUSTED_PROXY_HEADER?.trim();
  if (!configured) return null;
  return configured.toLowerCase();
}

/**
 * Extract the client IP.
 *
 * X-Forwarded-For is attacker-controlled unless a trusted proxy sets it, so we
 * only trust it when TRUSTED_PROXY_HEADER is explicitly configured and the
 * platform's own header is present. Otherwise fall back to a stable
 * connection-derived value.
 */
export function clientIp(req: NextRequest): string {
  const header = trustedProxyHeader();
  if (header) {
    const raw = req.headers.get(header);
    if (raw) {
      const first = raw.split(",")[0]?.trim();
      if (first) return normalizeIp(first);
    }
  }
  const direct = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  if (direct) {
    const first = direct.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  return "unknown";
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  // Strip IPv6 zone index and brackets.
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 0) return trimmed.slice(1, end).toLowerCase();
  }
  return trimmed.split("%")[0].toLowerCase();
}

/** Stable, non-reversible per-IP id (an IP is personal data; do not log it raw). */
function ipIdentityOf(ip: string): string {
  if (ip === "unknown") return `ip:${fingerprint(`unknown-${process.env.INSTANCE_SALT ?? ""}`)}`;
  return `ip:${fingerprint(`ip:${ip}:${process.env.INSTANCE_SALT ?? ""}`)}`;
}

/**
 * Optional shared-token gate. When SITESCORE_ACCESS_TOKEN is set, every
 * request must present a matching `x-sitescore-token` header. This is the
 * cheapest way to stop drive-by abuse of a public deployment.
 */
export function checkAccessToken(req: NextRequest): boolean {
  const expected = securityConfig().sharedAccessToken;
  if (!expected) return true;
  const provided = req.headers.get("x-sitescore-token") ?? "";
  return safeEqual(expected, provided);
}

/**
 * Resolve which provider key source this request will use.
 * BYOK wins; platform fallback is only permitted when explicitly allowed.
 */
export function resolveKeySource(hasByok: boolean): "byok" | "platform" | "none" {
  const platformAvailable = Boolean((process.env.TINYFISH_API_KEY ?? "").trim());
  if (hasByok) return "byok";
  if (platformAvailable && allowPlatformKey()) return "platform";
  return "none";
}

/**
 * The single pre-flight gate for an audit request.
 */
export async function gateAuditRequest(args: {
  req: NextRequest;
  /** Raw BYOK key from the request body, or null. Fingerprinted, never logged. */
  byokKey: string | null;
  wantsLlm: boolean;
}): Promise<GateResult> {
  const cfg = securityConfig();
  const requestId = args.req.headers.get("x-request-id") ?? newRequestId();
  const ip = clientIp(args.req);
  const ipIdentity = ipIdentityOf(ip);

  const hasByok = Boolean(args.byokKey && args.byokKey.trim().length > 0);
  // Fingerprint computed BEFORE rate limiting so per-key quotas are effective.
  // The raw key is never stored on the identity object.
  const byokFingerprint = hasByok ? fingerprint(args.byokKey) : "none";
  const keySource = resolveKeySource(hasByok);

  const identity: CallerIdentity = {
    requestId,
    ip,
    ipIdentity,
    // Rate-limit against the key when we have one, so quotas follow the
    // credential that actually pays; always ALSO limited by IP below.
    actorId: hasByok ? `key:${byokFingerprint}` : ipIdentity,
    keyId: keySource === "platform" ? "platform" : byokFingerprint,
    keySource,
    hasByokKey: hasByok,
    byokFingerprint,
  };

  const reject = (
    status: number,
    code: GateRejection,
    message: string,
    retryAfterSec: number,
    extra?: { scope?: string; limit?: number }
  ): GateFailure => {
    auditLog({
      event: code === "unauthorized" ? "auth.denied" : "rate_limited",
      requestId,
      actorId: identity.actorId,
      keyId: identity.keyId,
      keySource,
      status: code,
      scope: extra?.scope,
      limit: extra?.limit,
      detail: message,
    });
    return { ok: false, status, code, message, retryAfterSec, identity };
  };

  // 1. Optional shared-token authentication.
  if (!checkAccessToken(args.req)) {
    return reject(401, "unauthorized", "A valid access token is required.", 0);
  }

  // 2. Key source must be resolvable.
  if (keySource === "none") {
    return reject(
      400,
      "missing_api_key",
      "A TinyFish API key is required. Add your own key under Settings → API keys. " +
        "Server-provided keys are disabled in production so requests are never billed to the site owner.",
      0
    );
  }

  // 3. Rate limits + concurrency.
  const decision: RateDecision = await checkRateLimit({
    identity: identity.actorId,
    ipIdentity: identity.ipIdentity,
  });
  if (!decision.allowed) {
    const status =
      decision.reason === "server_busy"
        ? 503
        : decision.reason === "rate_limiter_unavailable"
          ? 503
          : 429;
    return reject(
      status,
      (decision.reason ?? "rate_limited") as GateRejection,
      decision.reason === "concurrency_limit"
        ? "Too many audits running at once. Wait for the current one to finish."
        : decision.reason === "rate_limiter_unavailable"
          ? "The request could not be admitted. Please retry shortly."
          : "Rate limit reached. Please wait before running another audit.",
      decision.retryAfterSec ?? 60,
      { scope: decision.scope, limit: decision.limit }
    );
  }

  // 4. Daily spend circuit breaker for the platform-owned key.
  //    This is the hard stop that bounds the developer's bill.
  if (keySource === "platform") {
    const budget = await checkBudget({
      scope: "platform",
      identity: "shared",
      limit: cfg.rate.globalPerDay,
    });
    if (!budget.allowed) {
      await releaseSlot(identity);
      return reject(
        429,
        budget.reason === "rate_limiter_unavailable" ? "rate_limiter_unavailable" : "budget_exhausted",
        budget.reason === "rate_limiter_unavailable"
          ? "The request could not be admitted. Please retry shortly."
          : "The daily audit budget is exhausted. Add your own API key to continue.",
        budget.retryAfterSec ?? 3600,
        { scope: "platform_daily_budget", limit: budget.limit }
      );
    }
  }

  // 5. LLM budget: only when this request will actually call an LLM and the
  //    platform key would pay for it.
  if (args.wantsLlm && keySource === "platform") {
    const llmBudget = await checkBudget({
      scope: "llm_platform",
      identity: "shared",
      limit: cfg.cost.llmPlatformKeyPerDay,
    });
    if (!llmBudget.allowed) {
      await releaseSlot(identity);
      return reject(
        429,
        llmBudget.reason === "rate_limiter_unavailable"
          ? "rate_limiter_unavailable"
          : "budget_exhausted",
        llmBudget.reason === "rate_limiter_unavailable"
          ? "The request could not be admitted. Please retry shortly."
          : "The daily AI summary budget is exhausted. Supply your own model key to continue.",
        llmBudget.retryAfterSec ?? 3600,
        { scope: "llm_daily_budget", limit: llmBudget.limit }
      );
    }
  }

  return {
    ok: true,
    identity,
    release: async () => {
      await releaseSlot(identity);
    },
  };
}

async function releaseSlot(identity: CallerIdentity): Promise<void> {
  const { releaseRateLimit } = await import("./rate-limit");
  await releaseRateLimit(identity.actorId);
}

/** Whether upstream error detail may be shown to clients. */
export function mayExposeUpstreamDetail(): boolean {
  return !isProduction() && !securityConfig().redactUpstreamErrors;
}