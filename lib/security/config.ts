/**
 * Central, typed, fail-closed security configuration.
 *
 * Every knob is environment-driven so nothing is hardcoded, and every value
 * is parsed with an explicit safe default. Parsing is lazy (not at module
 * load) so that importing this module can never throw during a build.
 *
 * SECURITY RULES encoded here:
 *  - Cost guards default to the STRICTEST value (fail-closed).
 *  - Platform-owned ("fallback") provider keys are DENIED in production
 *    unless explicitly opted back in, so anonymous traffic can never be
 *    billed to the developer.
 */

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return fallback;
}

/** Parse an integer env var, clamped to [min, max]. */
function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** True when running outside a production build (local dev, tests). */
export function isProduction(): boolean {
  return str("NODE_ENV", "development") === "production";
}

/**
 * Whether requests WITHOUT a caller-supplied (BYOK) key may be served using
 * the server's platform-owned key.
 *
 * Fail-closed default: DENIED in production, ALLOWED in dev so the local
 * "just works" flow documented in the README keeps working.
 */
export function allowPlatformKey(): boolean {
  if (process.env.ALLOW_PLATFORM_KEY !== undefined) {
    return bool("ALLOW_PLATFORM_KEY", !isProduction());
  }
  return !isProduction();
}

export interface RateConfig {
  /** Requests per minute, per identity (IP or key fingerprint). */
  perMinute: number;
  /** Requests per hour, per identity. */
  perHour: number;
  /** Requests per day, per identity - the hard spend ceiling per client. */
  perDay: number;
  /** Process-wide ceiling per day - protects the platform key budget. */
  globalPerDay: number;
  /** Process-wide ceiling per hour across all clients. */
  globalPerHour: number;
  /** Max simultaneously in-flight provider calls in this process. */
  maxConcurrent: number;
  /** Max simultaneous in-flight requests per identity. */
  maxConcurrentPerIdentity: number;
}

export interface CostConfig {
  /** Max LLM output tokens. Clamped server-side; never trusted from client. */
  llmMaxOutputTokens: number;
  /** Max characters of untrusted page content injected into an LLM prompt. */
  llmMaxPromptChars: number;
  /** Max upstream provider calls a single audit may make. */
  maxUpstreamCallsPerAudit: number;
  /** Ceiling on the wall-clock time one audit may spend upstream. */
  maxAuditDurationMs: number;
  /** Optional daily ceiling on LLM calls made with the platform key. */
  llmPlatformKeyPerDay: number;
}

export interface CryptoConfig {
  /** Master key material for the AES-256-GCM keyring. Empty = disabled. */
  keyring: string;
  /** Salt for scrypt master-key derivation. */
  salt: string;
  /** Fallback salt used when none is configured (dev only). */
  enabled: boolean;
}

export interface RedisConfig {
  url: string;
  token: string;
}

export interface SecurityConfig {
  rate: RateConfig;
  cost: CostConfig;
  crypto: CryptoConfig;
  redis: RedisConfig;
  /** When a configured rate-limit backend errors, deny (true) or allow (false). */
  rateLimitFailClosed: boolean;
  /** Strip upstream/provider error detail from client-facing messages. */
  redactUpstreamErrors: boolean;
  /** Audit-log every request through the app. */
  auditLogEnabled: boolean;
  /** Emit an alert event when rolling usage spikes past this multiplier. */
  anomalySpikeFactor: number;
  /** Absolute daily request count that triggers a hard alert. */
  anomalyAbsoluteThreshold: number;
  /** Optional shared secret clients must send as `x-sitescore-token`. */
  sharedAccessToken: string;
}

let cached: SecurityConfig | null = null;

export function securityConfig(): SecurityConfig {
  if (cached) return cached;
  const prod = isProduction();
  cached = {
    rate: {
      // BYOK users get a generous-but-bounded allowance.
      perMinute: int("RATE_LIMIT_PER_MINUTE", prod ? 10 : 60, 1, 10_000),
      perHour: int("RATE_LIMIT_PER_HOUR", prod ? 120 : 3_000, 1, 100_000),
      perDay: int("RATE_LIMIT_PER_DAY", prod ? 500 : 20_000, 1, 1_000_000),
      // Platform-wide ceilings: the last line of defence for the dev's bill.
      globalPerHour: int("RATE_LIMIT_GLOBAL_PER_HOUR", prod ? 3_000 : 100_000, 1, 10_000_000),
      globalPerDay: int("RATE_LIMIT_GLOBAL_PER_DAY", prod ? 20_000 : 1_000_000, 1, 10_000_000),
      maxConcurrent: int("RATE_LIMIT_MAX_CONCURRENT", prod ? 10 : 50, 1, 1_000),
      maxConcurrentPerIdentity: int("RATE_LIMIT_MAX_CONCURRENT_PER_IDENTITY", 2, 1, 100),
    },
    cost: {
      llmMaxOutputTokens: int("LLM_MAX_OUTPUT_TOKENS", 600, 64, 8_192),
      llmMaxPromptChars: int("LLM_MAX_PROMPT_CHARS", 12_000, 1_000, 200_000),
      maxUpstreamCallsPerAudit: int("MAX_UPSTREAM_CALLS_PER_AUDIT", 4, 1, 32),
      maxAuditDurationMs: int("MAX_AUDIT_DURATION_MS", prod ? 100_000 : 300_000, 5_000, 600_000),
      llmPlatformKeyPerDay: int("LLM_PLATFORM_KEY_PER_DAY", prod ? 50 : 5_000, 0, 1_000_000),
    },
    crypto: {
      keyring: str("KEY_ENCRYPTION_KEYRING", ""),
      salt: str("KEY_ENCRYPTION_SALT", ""),
      // Fail-closed: without an explicit key the store refuses to persist.
      enabled: str("KEY_ENCRYPTION_KEYRING", "").length > 0,
    },
    redis: {
      url: str("UPSTASH_REDIS_REST_URL", ""),
      token: str("UPSTASH_REDIS_REST_TOKEN", ""),
    },
    rateLimitFailClosed: bool("RATELIMIT_FAIL_CLOSED", true),
    redactUpstreamErrors: bool("REDACT_UPSTREAM_ERRORS", true),
    auditLogEnabled: bool("AUDIT_LOG_ENABLED", true),
    anomalySpikeFactor: Number(str("ANOMALY_SPIKE_FACTOR", "3")) || 3,
    anomalyAbsoluteThreshold: int("ANOMALY_ABSOLUTE_THRESHOLD", 2_000, 1, 10_000_000),
    sharedAccessToken: str("SITESCORE_ACCESS_TOKEN", ""),
  };
  return cached;
}

/** Test seam: drop the memoized config. */
export function resetSecurityConfig(): void {
  cached = null;
}