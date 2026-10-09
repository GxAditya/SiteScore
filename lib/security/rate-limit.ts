/**
 * Server-side rate limiting, concurrency control and budget circuit breakers.
 *
 * Design goals, in priority order:
 *  1. FAIL CLOSED for cost - a limit we cannot evaluate must not let a call
 *     through. This is the whole point: an unavailable limiter must never
 *     become "unlimited spend".
 *  2. Bounded memory - all in-process state is swept and hard-capped.
 *  3. Production-ready - an optional Redis (Upstash REST) backend gives
 *     correct limits across serverless instances; without it we still get
 *     per-instance protection, which is strictly better than nothing.
 *
 * Every check runs BEFORE any provider/LLM call is made.
 */

import { securityConfig } from "./config";

export interface RateDecision {
  allowed: boolean;
  /** Coarse reason surfaced to the client (never leaks internals). */
  reason?: string;
  /** Seconds the client should wait before retrying. */
  retryAfterSec?: number;
  /** Which limit tripped - for logging only. */
  scope?: string;
  limit?: number;
  remaining?: number;
}

const ALLOW: RateDecision = { allowed: true };

// ---------------------------------------------------------------------------
// In-memory fixed-window counters
// ---------------------------------------------------------------------------

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();
const inflight = new Map<string, number>();
const globalInflight = { value: 0 };

/** Hard cap on distinct tracked keys so an attacker cannot OOM the process. */
const MAX_TRACKED_KEYS = 50_000;
/** Sweep interval for expired counters. */
const SWEEP_MS = 60_000;

let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_MS) return;
  lastSweep = now;
  for (const [key, entry] of counters) {
    if (entry.resetAt <= now) counters.delete(key);
  }
  // Evict expired identity counters too.
  for (const [key, value] of inflight) {
    if (value <= 0) inflight.delete(key);
  }
}

/** Increment a fixed window; returns the new count and when it resets. */
function hit(key: string, windowMs: number, now: number): Counter {
  sweep(now);
  const existing = counters.get(key);
  if (existing && existing.resetAt > now) {
    existing.count += 1;
    return existing;
  }
  // Memory bound: drop expired first, then refuse to grow without limit.
  if (counters.size >= MAX_TRACKED_KEYS) {
    for (const [k, v] of counters) {
      if (v.resetAt <= now) counters.delete(k);
    }
    if (counters.size >= MAX_TRACKED_KEYS) {
      // Still full of live windows - evict the oldest we can find cheaply.
      let oldestKey: string | undefined;
      let oldestAt = Infinity;
      for (const [k, v] of counters) {
        if (v.resetAt < oldestAt) {
          oldestAt = v.resetAt;
          oldestKey = k;
        }
      }
      if (oldestKey) counters.delete(oldestKey);
    }
  }
  const fresh: Counter = { count: 1, resetAt: now + windowMs };
  counters.set(key, fresh);
  return fresh;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Optional distributed backend (Upstash / Redis REST, pipelined)
// ---------------------------------------------------------------------------

interface RedisConfig {
  url: string;
  token: string;
}

function redisConfig(): RedisConfig | null {
  const cfg = securityConfig().redis;
  return cfg.url && cfg.token ? cfg : null;
}

/**
 * Atomically increment several counters via a Redis pipeline.
 * Returns null when the backend is unavailable so the caller can decide.
 */
async function redisHitMany(
  entries: Array<{ key: string; windowMs: number }>
): Promise<Record<string, number> | null> {
  const rc = redisConfig();
  if (!rc) return null;
  type RedisCommand = [string, ...(string | number)[]];
const pipeline: RedisCommand[] = entries.flatMap((e) => [
    ["INCR", e.key],
    ["PEXPIRE", e.key, e.windowMs],
  ]);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const res = await fetch(rc.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rc.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    if (!Array.isArray(parsed)) return null;
    const out: Record<string, number> = {};
    entries.forEach((e, i) => {
      const raw = parsed[i * 2];
      const n = Array.isArray(raw) ? raw[1] : raw;
      if (typeof n === "number") out[e.key] = n;
      else if (typeof n === "string" && /^\d+$/.test(n)) out[e.key] = Number(n);
    });
    return Object.keys(out).length === entries.length ? out : null;
  } catch {
    return null;
  }
}

async function redisRelease(key: string): Promise<void> {
  const rc = redisConfig();
  if (!rc) return;
  try {
    await fetch(rc.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rc.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["DECR", key],
        ["PEXPIRE", key, 60_000],
      ]),
    });
  } catch {
    /* best effort - TTL bounds the damage */
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reserve one request against every configured window.
 *
 * `identity` should be the strongest stable identifier available:
 * the non-reversible key fingerprint when a BYOK key was supplied,
 * otherwise the client IP. A dedicated `ipIdentity` is always additionally
 * limited so one IP cannot rotate keys to multiply its allowance.
 */
export async function checkRateLimit(args: {
  identity: string;
  ipIdentity: string;
}): Promise<RateDecision> {
  const cfg = securityConfig();
  const now = Date.now();

  const windows: Array<{ name: string; key: string; windowMs: number; limit: number }> = [
    { name: "identity_minute", key: `ss:rl:im:${args.identity}`, windowMs: MINUTE, limit: cfg.rate.perMinute },
    { name: "identity_hour", key: `ss:rl:ih:${args.identity}`, windowMs: HOUR, limit: cfg.rate.perHour },
    { name: "identity_day", key: `ss:rl:id:${args.identity}`, windowMs: DAY, limit: cfg.rate.perDay },
    { name: "ip_minute", key: `ss:rl:pm:${args.ipIdentity}`, windowMs: MINUTE, limit: cfg.rate.perMinute },
    { name: "ip_hour", key: `ss:rl:ph:${args.ipIdentity}`, windowMs: HOUR, limit: cfg.rate.perHour },
    { name: "global_hour", key: `ss:rl:gh`, windowMs: HOUR, limit: cfg.rate.globalPerHour },
    { name: "global_day", key: `ss:rl:gd`, windowMs: DAY, limit: cfg.rate.globalPerDay },
  ];

  // --- Distributed path: evaluate atomically, fail closed on error ---------
  const remote = await redisHitMany(windows);
  if (remote) {
    for (const w of windows) {
      const used = remote[w.key] ?? 0;
      if (used > w.limit) {
        const retry = Math.max(1, Math.ceil(((used - w.limit) / Math.max(1, w.limit)) * 60));
        return {
          allowed: false,
          reason: "rate_limited",
          scope: w.name,
          limit: w.limit,
          remaining: 0,
          retryAfterSec: Math.min(retry, 3600),
        };
      }
    }
  } else if (redisConfig()) {
    // A configured-but-broken backend must NOT become unlimited spend.
    if (cfg.rateLimitFailClosed) {
      return { allowed: false, reason: "rate_limiter_unavailable", scope: "backend", retryAfterSec: 30 };
    }
  } else {
    // --- Local path -------------------------------------------------------
    for (const w of windows) {
      const c = hit(w.key, w.windowMs, now);
      if (c.count > w.limit) {
        return {
          allowed: false,
          reason: "rate_limited",
          scope: w.name,
          limit: w.limit,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((c.resetAt - now) / 1000)),
        };
      }
    }
  }

  // --- Concurrency semaphore ---------------------------------------------
  const current = inflight.get(args.identity) ?? 0;
  if (current >= cfg.rate.maxConcurrentPerIdentity) {
    return {
      allowed: false,
      reason: "concurrency_limit",
      scope: "identity",
      limit: cfg.rate.maxConcurrentPerIdentity,
      remaining: 0,
      retryAfterSec: 5,
    };
  }
  if (globalInflight.value >= cfg.rate.maxConcurrent) {
    return {
      allowed: false,
      reason: "server_busy",
      scope: "global",
      limit: cfg.rate.maxConcurrent,
      remaining: 0,
      retryAfterSec: 10,
    };
  }
  inflight.set(args.identity, current + 1);
  globalInflight.value += 1;
  return ALLOW;
}

/** Release a concurrency slot previously reserved by `checkRateLimit`. */
export async function releaseRateLimit(identity: string): Promise<void> {
  const next = (inflight.get(identity) ?? 1) - 1;
  if (next <= 0) inflight.delete(identity);
  else inflight.set(identity, next);
  globalInflight.value = Math.max(0, globalInflight.value - 1);
  if (redisConfig()) await redisRelease(`ss:rl:im:${identity}`);
}

/**
 * Budget circuit breaker for a metered resource, scoped by an identity.
 * Returns a decision WITHOUT consuming the budget when already exhausted.
 */
export async function checkBudget(args: {
  scope: string;
  identity: string;
  limit: number;
}): Promise<RateDecision> {
  if (args.limit <= 0) {
    return { allowed: false, reason: "budget_disabled", scope: args.scope, retryAfterSec: 86_400 };
  }
  const key = `ss:budget:${args.scope}:${args.identity}`;
  const now = Date.now();
  const remote = await redisHitMany([{ key, windowMs: DAY }]);
  if (remote) {
    const used = remote[key] ?? 0;
    if (used > args.limit) {
      return {
        allowed: false,
        reason: "budget_exhausted",
        scope: args.scope,
        limit: args.limit,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((DAY - (now % DAY)) / 1000)),
      };
    }
    return ALLOW;
  }
  if (redisConfig() && securityConfig().rateLimitFailClosed) {
    return { allowed: false, reason: "rate_limiter_unavailable", scope: "budget", retryAfterSec: 30 };
  }
  const c = hit(key, DAY, now);
  if (c.count > args.limit) {
    return {
      allowed: false,
      reason: "budget_exhausted",
      scope: args.scope,
      limit: args.limit,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((c.resetAt - now) / 1000)),
    };
  }
  return ALLOW;
}

/** Current in-flight count (diagnostics/tests). */
export function inFlightCount(): number {
  return globalInflight.value;
}

/** Reset all limiter state (tests only). */
export function resetRateLimiter(): void {
  counters.clear();
  inflight.clear();
  globalInflight.value = 0;
  lastSweep = 0;
}