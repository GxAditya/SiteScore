/**
 * Structured audit logging + usage-spike anomaly detection.
 *
 * Privacy contract: events may contain user id, key FINGERPRINT (a truncated
 * HMAC, never the key), model, token counts, latency and status. They must
 * never contain key material, full request bodies, or unredacted upstream
 * error text.
 *
 * Tamper evidence: each emitted line carries a hash-chained `prev` digest so
 * deletion or in-place editing of a record breaks the chain and is
 * detectable. This is append-only *evidence*, not a WORM store - it raises
 * the cost of tampering, it does not prevent a host-level attacker.
 */

import { createHash } from "node:crypto";
import { securityConfig } from "./config";
import { newRequestId, redact } from "./redact";

export type SecurityEventName =
  | "audit.started"
  | "audit.completed"
  | "audit.failed"
  | "auth.denied"
  | "rate_limited"
  | "budget_exhausted"
  | "llm.call"
  | "key.used"
  | "security.anomaly";

export interface SecurityEvent {
  event: SecurityEventName;
  requestId: string;
  /** Non-reversible identifier for the caller (never an IP in production logs). */
  actorId: string;
  /** Non-reversible key fingerprint, or "none"/"platform". */
  keyId: string;
  keySource: "byok" | "platform" | "none";
  status?: string;
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  upstreamCalls?: number;
  scope?: string;
  limit?: number;
  targetHost?: string;
  /** Free text - ALWAYS passed through redact() before serialization. */
  detail?: string;
  ts: number;
  prev: string;
  seq: number;
  hash: string;
}

const CHAIN_SEED = "sitescore-audit-chain-v1";
let lastHash = CHAIN_SEED;
let seq = 0;

function digestOf(payload: Omit<SecurityEvent, "hash">): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

function eventLine(e: SecurityEvent): string {
  return JSON.stringify(e);
}

/**
 * Emit one audit event. Serialized as JSON on stdout so any log shipper
 * (Datadog, CloudWatch, Loki...) can parse it without regex.
 */
export function auditLog(
  event: Omit<
    SecurityEvent,
    "ts" | "prev" | "seq" | "hash" | "requestId" | "actorId" | "keyId" | "keySource"
  > &
    Partial<
      Pick<SecurityEvent, "requestId" | "actorId" | "keyId" | "keySource">
    >
): void {
  if (!securityConfig().auditLogEnabled) return;

  const base: Omit<SecurityEvent, "hash"> = {
    event: event.event,
    requestId: event.requestId ?? newRequestId(),
    actorId: event.actorId ?? "anonymous",
    keyId: event.keyId ?? "none",
    keySource: event.keySource ?? "none",
    ts: Date.now(),
    prev: lastHash,
    seq: seq++,
  };
  if (event.status !== undefined) base.status = event.status;
  if (event.model !== undefined) base.model = event.model;
  if (event.promptTokens !== undefined) base.promptTokens = event.promptTokens;
  if (event.outputTokens !== undefined) base.outputTokens = event.outputTokens;
  if (event.totalTokens !== undefined) base.totalTokens = event.totalTokens;
  if (event.latencyMs !== undefined) base.latencyMs = event.latencyMs;
  if (event.upstreamCalls !== undefined) base.upstreamCalls = event.upstreamCalls;
  if (event.scope !== undefined) base.scope = event.scope;
  if (event.limit !== undefined) base.limit = event.limit;
  if (event.targetHost !== undefined) base.targetHost = event.targetHost;
  // Detail is untrusted text: redact before it can ever reach a sink.
  if (event.detail !== undefined) base.detail = redact(event.detail, 500);

  const full: SecurityEvent = { ...base, hash: digestOf(base) };
  lastHash = full.hash;
  // Single write call keeps the line atomic in most runtimes.
  process.stdout.write(`${eventLine(full)}\n`);
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

const windowCounts = new Map<string, { count: number; windowStart: number }>();
const ANOMALY_WINDOW_MS = 60_000;

/**
 * Detect usage spikes. Two independent triggers:
 *  - absolute: more than `anomalyAbsoluteThreshold` calls in one minute;
 *  - relative: a jump of >= `anomalySpikeFactor` versus the previous minute.
 * Emits `security.anomaly` so log alerting can pick it up.
 */
export function recordUsage(args: {
  actorId: string;
  keyId: string;
  count?: number;
}): void {
  const cfg = securityConfig();
  if (!cfg.auditLogEnabled) return;
  const now = Date.now();
  const bucket = Math.floor(now / ANOMALY_WINDOW_MS);
  const key = args.actorId;

  const prev = windowCounts.get(key);
  if (!prev || bucket !== prev.windowStart) {
    const previousWindow = prev && bucket === prev.windowStart + 1 ? prev.count : 0;
    const current = args.count ?? 1;
    if (current >= cfg.anomalyAbsoluteThreshold) {
      auditLog({
        event: "security.anomaly",
        actorId: args.actorId,
        keyId: args.keyId,
        detail: `absolute_usage_spike: ${current} calls in 60s (threshold ${cfg.anomalyAbsoluteThreshold})`,
        status: "alert",
      });
    } else if (
      previousWindow > 0 &&
      current >= previousWindow * cfg.anomalySpikeFactor &&
      previousWindow >= 10
    ) {
      auditLog({
        event: "security.anomaly",
        actorId: args.actorId,
        keyId: args.keyId,
        detail: `relative_usage_spike: ${current} calls in 60s vs ${previousWindow} previous (factor ${cfg.anomalySpikeFactor})`,
        status: "alert",
      });
    }
    if (windowCounts.size > 10_000) windowCounts.clear();
    windowCounts.set(key, { count: current, windowStart: bucket });
  } else {
    prev.count += args.count ?? 1;
  }
}

/** Chain state for verification tooling/tests. */
export function auditChainHead(): string {
  return lastHash;
}

/** Reset chain + anomaly state (tests only). */
export function resetAuditLog(): void {
  lastHash = CHAIN_SEED;
  seq = 0;
  windowCounts.clear();
}