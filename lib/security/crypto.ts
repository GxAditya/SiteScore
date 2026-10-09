/**
 * AES-256-GCM envelope encryption for provider keys held at rest.
 *
 * Why this exists: SiteScore's BYOK flow is *ephemeral by default* - keys are
 * held in browser memory for one request and never persisted server-side. This
 * module is the sanctioned primitive for the cases where a key must be
 * remembered (e.g. an opt-in server-side cache), so that any such storage is
 * encrypted rather than plaintext by accident.
 *
 * Properties:
 *  - AES-256-GCM, 96-bit random IV per encryption, auth tag verified.
 *  - Key derivation: scrypt (N=2^15) over a configured keyring + salt.
 *  - Key ROTATION: the keyring is a comma-separated list of
 *    `kid:base64-32-byte-key`. Decryption uses the `kid` embedded in the
 *    envelope; encryption always uses the FIRST entry (the active key).
 *    Adding a new active key and keeping old ones = zero-downtime rotation.
 *  - Key REVOCATION: remove a `kid` from the keyring and every envelope
 *    sealed under it fails authentication and is unusable.
 *  - Envelope: `v1.<kid>.<iv_b64url>.<ct_b64url>.<tag_b64url>`
 *  - AAD binds each ciphertext to its record id, so a ciphertext cannot be
 *    moved between records (defeats cross-record swapping).
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { securityConfig } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;
const ENVELOPE_VERSION = "v1";
const SCRYPT_PARAMS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export interface KeyringEntry {
  kid: string;
  key: Buffer;
}

export class KeyringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyringError";
  }
}

let cachedKeyring: KeyringEntry[] | null = null;

/**
 * Parse KEY_ENCRYPTION_KEYRING into key material.
 * Format: `kid:base64key,kid2:base64key2`. The first entry is active.
 */
export function loadKeyring(specOverride?: string): KeyringEntry[] {
  if (specOverride !== undefined) return parseKeyring(specOverride);
  if (cachedKeyring) return cachedKeyring;
  const spec = securityConfig().crypto.keyring;
  if (!spec) {
    cachedKeyring = [];
    return cachedKeyring;
  }
  cachedKeyring = parseKeyring(spec);
  return cachedKeyring;
}

function parseKeyring(spec: string): KeyringEntry[] {
  const entries: KeyringEntry[] = [];
  const seen = new Set<string>();
  for (const part of spec.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(":");
    if (sep <= 0) {
      throw new KeyringError("keyring entry must be '<kid>:<base64 32-byte key>'");
    }
    const kid = trimmed.slice(0, sep).trim();
    const raw = trimmed.slice(sep + 1).trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid)) {
      throw new KeyringError("keyring kid must match [A-Za-z0-9_-]{1,64}");
    }
    if (seen.has(kid)) throw new KeyringError(`duplicate keyring kid: ${kid}`);
    seen.add(kid);
    const key = Buffer.from(raw, "base64");
    if (key.length !== KEY_BYTES) {
      throw new KeyringError(`keyring key '${kid}' must decode to ${KEY_BYTES} bytes`);
    }
    entries.push({ kid, key });
  }
  if (entries.length === 0) {
    throw new KeyringError("keyring is empty; cannot encrypt");
  }
  return entries;
}

/**
 * Derive a per-deployment data key from the raw keyring material.
 * The scrypt salt is deployment-wide; combined with the per-entry key this
 * gives defence in depth if the raw keyring file leaks.
 */
function deriveDataKey(entry: KeyringEntry): Buffer {
  const salt = securityConfig().crypto.salt || "sitescore-default-dev-salt";
  return scryptSync(
    Buffer.concat([Buffer.from(entry.kid, "utf8"), Buffer.from([0]), entry.key]),
    salt,
    KEY_BYTES,
    SCRYPT_PARAMS
  );
}

function b64u(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64u(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** True when a keyring is configured and encryption can be performed. */
export function isEncryptionEnabled(): boolean {
  return loadKeyring().length > 0;
}

/** The active (write) key id. */
export function activeKeyId(): string {
  const ring = loadKeyring();
  if (ring.length === 0) {
    throw new KeyringError("KEY_ENCRYPTION_KEYRING is not configured");
  }
  return ring[0].kid;
}

/**
 * Encrypt a secret with the active key.
 *
 * @param secret        plaintext key material
 * @param aadRecordId   record-scoped additional authenticated data; binds the
 *                      ciphertext to a specific record so it cannot be moved.
 */
export function encryptSecret(secret: string, aadRecordId: string): string {
  const ring = loadKeyring();
  if (ring.length === 0) {
    // Fail closed: silently storing plaintext is exactly what we are preventing.
    throw new KeyringError("KEY_ENCRYPTION_KEYRING is not configured; refusing to store secrets");
  }
  if (typeof secret !== "string" || secret.length === 0) {
    throw new KeyringError("nothing to encrypt");
  }
  const active = ring[0];
  const dataKey = deriveDataKey(active);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dataKey, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(`${ENVELOPE_VERSION}|${active.kid}|${aadRecordId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    active.kid,
    b64u(iv),
    b64u(ciphertext),
    b64u(tag),
  ].join(".");
}

/**
 * Decrypt an envelope produced by `encryptSecret`.
 * Throws on any tampering, wrong key id, or AAD mismatch.
 */
export function decryptSecret(envelope: string, aadRecordId: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 5) throw new KeyringError("malformed secret envelope");
  const [version, kid, ivB64, ctB64, tagB64] = parts;
  if (version !== ENVELOPE_VERSION) throw new KeyringError(`unsupported envelope version`);
  const ring = loadKeyring();
  // A missing kid means that key was revoked from the keyring.
  const entry = ring.find((e) => e.kid === kid);
  if (!entry) throw new KeyringError(`key id '${kid}' is not in the keyring (revoked or rotated out)`);
  const dataKey = deriveDataKey(entry);
  const iv = fromB64u(ivB64);
  const tag = fromB64u(tagB64);
  if (iv.length !== IV_BYTES) throw new KeyringError("invalid IV length");
  if (tag.length !== TAG_BYTES) throw new KeyringError("invalid auth tag length");
  const decipher = createDecipheriv(ALGORITHM, dataKey, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(`${ENVELOPE_VERSION}|${kid}|${aadRecordId}`, "utf8"));
  decipher.setAuthTag(tag);
  try {
    const out = Buffer.concat([decipher.update(fromB64u(ctB64)), decipher.final()]);
    return out.toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext - indistinguishable by design.
    throw new KeyringError("secret authentication failed (wrong key or tampered data)");
  }
}

/** Constant-time string compare helper for key-id checks in admin tooling. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Reset cached keyring (tests / runtime key reload after rotation). */
export function resetKeyring(): void {
  cachedKeyring = null;
}