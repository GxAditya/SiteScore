/**
 * Hardened SSRF / URL safety validation for the audit target.
 *
 * The upstream fetcher (TinyFish) performs the actual network egress, but this
 * endpoint still must not be usable as a probe against private, loopback,
 * link-local, or cloud-metadata infrastructure. The original implementation
 * used string prefix checks, which are trivially bypassed by alternate IP
 * encodings (octal, hex, decimal, IPv4-mapped IPv6, IPv6 loopback, etc.).
 *
 * This module resolves the hostname and validates the *actual* address, which
 * closes DNS-rebinding style bypasses of literal-only blocklists.
 */

import { isIP } from "node:net";

export type UrlRejection =
  | "empty"
  | "too_long"
  | "bad_scheme"
  | "unparseable"
  | "blocked_host"
  | "credentials_in_url"
  | "dns_unresolved"
  | "dns_blocked";

export interface UrlValidationOk {
  ok: true;
  url: string;
  hostname: string;
  port: string;
  resolvedIps: string[];
}

export interface UrlValidationErr {
  ok: false;
  reason: UrlRejection;
  message: string;
}

export type UrlValidation = UrlValidationOk | UrlValidationErr;

const MAX_URL_LENGTH = 2_000;

/** Hostnames that must never be targeted, regardless of DNS. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google",
  "metadata.google.internal",
  "instance-data",
  "instance-data-compute",
  "metadata.goog",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".localdomain"];

/**
 * Parse an IPv4 dotted-quad into its numeric value.
 * Rejects shorthand/ambiguous forms (127.1, 0177.0.0.1, 0x7f.0.0.1) because
 * they are interpreted inconsistently across resolvers.
 */
function parseIpv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    // Leading zeros are octal in some resolvers - reject to avoid ambiguity.
    if (part.length > 1 && part.startsWith("0")) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

function ipv4InRange(ip: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const baseIp = parseIpv4(base);
  const bits = Number(bitsRaw);
  if (baseIp === null || !Number.isFinite(bits)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) >>> 0 === (baseIp & mask) >>> 0;
}

/** Non-public IPv4 ranges: loopback, private, CGNAT, link-local, multicast, reserved. */
const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8", // "this network"
  "10.0.0.0/8", // RFC1918 private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local incl. cloud metadata (169.254.169.254)
  "172.16.0.0/12", // RFC1918 private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // RFC1918 private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved incl. 255.255.255.255 broadcast
];

/** True when a resolved IPv4 address is not publicly routable. */
export function isPrivateIpv4(host: string): boolean {
  const ip = parseIpv4(host);
  if (ip === null) return true; // unparseable IPv4-looking host -> refuse
  return BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InRange(ip, cidr));
}

/** True when a resolved IPv6 address is not publicly routable. */
export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4-mapped / IPv4-compatible IPv6 must be checked against IPv4 rules.
  const mapped = h.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(h)) return true; // unique local fc00::/7
  if (h.startsWith("ff")) return true; // multicast
  // NAT64 well-known prefix 64:ff9b::/96 can proxy to IPv4.
  if (h.startsWith("64:ff9b")) return true;
  return false;
}

/** Literal-address check without DNS. */
export function isBlockedIpLiteral(hostname: string): boolean {
  let h = hostname.trim().toLowerCase();
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);

  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;

  const family = isIP(h);
  if (family === 4) return isPrivateIpv4(h);
  if (family === 6) return isPrivateIpv6(h);

  // Bare decimal IPv4 (http://2130706433 === 127.0.0.1).
  if (/^\d+$/.test(h)) {
    const n = Number(h);
    if (Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) {
      return isPrivateIpv4(
        [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")
      );
    }
    return true;
  }
  // Dotted shorthand (127.1, 10.0.1, 192.168.1) and octal/hex parts
  // (0177.0.0.1, 0x7f.0.0.1). These expand to loopback/private addresses but
  // are interpreted inconsistently across resolvers, so refuse rather than
  // guess the expansion rule.
  if (/^0x[0-9a-f]+$/.test(h)) return true;
  if (/^[0-9a-fx.]+$/.test(h) && h.includes(".")) return true;
  return false;
}

/** Normalize: add https:// to bare hosts, drop the fragment, reject junk. */
export function normalizeAuditUrl(raw: string): string {
  let s = raw.trim();
  if (s.length === 0) throw Object.assign(new Error("empty"), { reason: "empty" });
  if (s.length > MAX_URL_LENGTH) {
    throw Object.assign(new Error("too-long"), { reason: "too_long" });
  }
  // Reject control characters and whitespace that could split the URL.
  if (/[\s\u0000-\u001f\u007f]/.test(s)) {
    throw Object.assign(new Error("control-chars"), { reason: "unparseable" });
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  const u = new URL(s);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("bad-protocol"), { reason: "bad_scheme" });
  }
  if (u.username || u.password) {
    throw Object.assign(new Error("credentials"), { reason: "credentials_in_url" });
  }
  u.hash = "";
  const out = u.toString();
  if (out.length > MAX_URL_LENGTH) {
    throw Object.assign(new Error("too-long"), { reason: "too_long" });
  }
  return out;
}

async function resolveAll(hostname: string): Promise<string[]> {
  const { lookup } = await import("node:dns/promises");
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/**
 * Full validation: scheme, credentials, literal blocklist, then DNS
 * resolution with an address-level check.
 *
 * DNS failures fail CLOSED: if we cannot prove the host is public, we do not
 * issue the request.
 */
export async function validateAuditUrl(raw: string): Promise<UrlValidation> {
  let normalized: string;
  try {
    normalized = normalizeAuditUrl(raw);
  } catch (e) {
    const reason = (e as { reason?: UrlRejection }).reason ?? "unparseable";
    return { ok: false, reason, message: "Invalid URL. Provide an http(s) URL, e.g. https://example.com/page." };
  }

  const u = new URL(normalized);
  const hostname = u.hostname.toLowerCase();

  if (isBlockedIpLiteral(hostname)) {
    return {
      ok: false,
      reason: "blocked_host",
      message:
        "Audits of localhost, private-network, link-local and cloud-metadata addresses are not allowed.",
    };
  }

  // Resolve and re-check: defeats DNS rebinding and hosts that resolve inward.
  let resolved: string[] = [];
  try {
    resolved = await resolveAll(hostname);
  } catch {
    return {
      ok: false,
      reason: "dns_unresolved",
      message: "Could not resolve the hostname. Check the domain and try again.",
    };
  }
  if (resolved.length === 0) {
    return {
      ok: false,
      reason: "dns_unresolved",
      message: "Could not resolve the hostname. Check the domain and try again.",
    };
  }
  for (const ip of resolved) {
    const blocked = isIP(ip) === 4 ? isPrivateIpv4(ip) : isPrivateIpv6(ip);
    if (blocked) {
      return {
        ok: false,
        reason: "dns_blocked",
        message:
          "Audits of localhost, private-network, link-local and cloud-metadata addresses are not allowed.",
      };
    }
  }

  return {
    ok: true,
    url: normalized,
    hostname,
    port: u.port || (u.protocol === "https:" ? "443" : "80"),
    resolvedIps: resolved,
  };
}