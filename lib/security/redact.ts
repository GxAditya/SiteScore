/**
 * Secret redaction + non-reversible key fingerprinting.
 *
 * Two distinct notions, deliberately kept apart:
 *  - `redact()`      removes secrets so text is safe to log or return.
 *  - `fingerprint()` produces a stable, non-reversible identifier so we can
 *                    attribute usage/spend to a key WITHOUT ever storing or
 *                    logging the key material itself.
 */

import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";

/** Vendor prefixes we scrub out of anything headed for a log or a client. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // Google / Gemini
  [/\bAIza[0-9A-Za-z_-]{10,}\b/g, "[REDACTED_GOOGLE_KEY]"],
  // OpenAI / Anthropic / general
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_SK_KEY]"],
  // AWS
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  // GitHub
  [/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  // Slack
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
  // Generic TinyFish keys (opaque; match the header value shape)
  [/\b(?:tf|sk_tinyfish)_[A-Za-z0-9]{16,}\b/g, "[REDACTED_TINYFISH_KEY]"],
  // Bearer / authorization headers
  [/\b(authorization|x-api-key|api[-_]?key)\b\s*[:=]\s*["']?[^\s"',;}]{6,}/gi, "$1: [REDACTED]"],
  // JSON-ish secret fields
  [/"(tinyfishKey|llmKey|apiKey|api_key|password|secret|token)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"'],
  // key= / token= query strings (Gemini ?key=... lives here)
  [/([?&](?:key|api_key|apikey|access_token|token)=)[^&\s]+/gi, "$1[REDACTED]"],
  // URL userinfo
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[REDACTED@]"],
];

/** PEM blocks (private keys) - stripped wholesale. */
const PEM_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

/**
 * Remove anything that looks like a credential from arbitrary text.
 * Safe to call on upstream error messages before they reach a log or client.
 */
export function redact(input: unknown, maxLen = 2_000): string {
  let s: string;
  if (input === null || input === undefined) s = "";
  else if (typeof input === "string") s = input;
  else if (input instanceof Error) s = `${input.name}: ${input.message}`;
  else {
    try {
      s = JSON.stringify(input) ?? String(input);
    } catch {
      s = String(input);
    }
  }
  s = s.replace(PEM_BLOCK, "[REDACTED_PRIVATE_KEY]");
  for (const [re, replacement] of SECRET_PATTERNS) {
    s = s.replace(re, replacement);
  }
  return s.length > maxLen ? `${s.slice(0, maxLen)}…[truncated]` : s;
}

function pepper(): string {
  return process.env.KEY_FINGERPRINT_PEPPER ?? "";
}

/**
 * Stable, non-reversible identifier for a secret.
 *
 * HMAC-SHA256 keyed by an optional server-side pepper, truncated to 16 hex
 * chars. Two uses:
 *  - correlate requests that used the same key (per-key rate limiting),
 *  - attribute spend in logs.
 * The key itself is never recoverable and never logged.
 */
export function fingerprint(secret: string | null | undefined): string {
  const s = (secret ?? "").trim();
  if (!s) return "none";
  return createHmac("sha256", pepper())
    .update(s, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/** Non-reversible identity for an arbitrary string (used for hash/equality). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Constant-time string comparison for shared-secret checks. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Still burn a comparison so length isn't leaked by timing.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Correlation id for one request, safe to log. */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Truncate a user-controlled string before it is embedded in a prompt.
 * Strips control characters that can forge newlines/roles in a prompt.
 */
export function sanitizeForPrompt(value: unknown, maxLen: number): string {
  let s = typeof value === "string" ? value : String(value ?? "");
  // Remove control chars except newline/tab, then collapse runs.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = s.replace(/\r\n?/g, "\n");
  // Neutralize common role/prompt-injection scaffolds.
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}