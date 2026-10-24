/**
 * Cognate Signed Requests Middleware — `cognate-request-v1` (PR a)
 *
 * Implements Ed25519 request signing via `node:crypto`, strict header/path
 * framing, RFC 8785 JCS body verification, ordered replay protection (600 s
 * retention), uniform 401 responses, sunset-gated `log` mode, and committed
 * per-tenant root key bootstrap verification.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize } from "json-canonicalize";
import type {
  ActorId,
  Agent,
  PrincipalKind,
  SignedRequestsMode,
  TenantId,
  TenantRootKeyEntry,
  TenantRootsConfig,
} from "@cognate/types";
import { getAgent, type IdentityRegistryState } from "@cognate/agent-identity";

/** RFC 8410 DER prefix for a raw 32-byte Ed25519 private seed (PKCS#8). */
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/** RFC 8410 DER prefix for a raw 32-byte Ed25519 public key (SPKI). */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Hard body size limit before JSON parsing (1 MiB). */
export const MAX_BODY_BYTES = 1_048_576;

/** Allowed timestamp clock skew window (±300 seconds). */
export const TIMESTAMP_WINDOW_MS = 300_000;

/** Maximum allowed duration for `signedRequests: "log"` sunset (14 days). */
export const MAX_LOG_MODE_SUNSET_MS = 14 * 24 * 60 * 60 * 1000;

/** SHA-256 hex digest of an empty byte string. */
export const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const RAW_PUBLIC_KEY_B64URL_RE = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE_B64URL_RE = /^[A-Za-z0-9_-]{86}$/;
const KID_HEX_RE = /^[0-9a-f]{64}$/;
const METHOD_RE = /^(GET|POST)$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const NONCE_RE = /^[A-Za-z0-9_-]{22,64}$/;
const AGENT_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const PCT_CONTROL_RE = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

/**
 * Single uniform 401 response body for every pre-signature authentication failure (Ruling 8).
 */
export const UNIFORM_UNAUTHENTICATED_BODY = Object.freeze({
  error: "auth.unauthenticated",
  code: "auth.unauthenticated",
  message: "Request authentication failed.",
  hint: "Sign the request with an active key, a current UTC timestamp, and a fresh nonce.",
});

export interface CanonicalRequestFields {
  readonly method: string;
  readonly path: string;
  readonly bodySha256: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly agentId: string;
  readonly keyId: string;
}

export interface Ed25519KeyPairMaterial {
  readonly seedHex: string;
  readonly publicKey: string;
  readonly kid: string;
}

/**
 * Check whether a value is a valid 43-character base64url raw 32-byte Ed25519 public key.
 */
export function isValidPublicKeyBase64Url(value: unknown): value is string {
  if (typeof value !== "string" || !RAW_PUBLIC_KEY_B64URL_RE.test(value)) {
    return false;
  }
  const raw = Buffer.from(value, "base64url");
  return raw.length === 32 && raw.toString("base64url") === value;
}

/**
 * Derive the 64-character lowercase hex SHA-256 `kid` from a base64url raw 32-byte Ed25519 public key,
 * or return `null` if the key is malformed.
 */
export function tryDeriveKid(publicKeyBase64Url: unknown): string | null {
  if (!isValidPublicKeyBase64Url(publicKeyBase64Url)) {
    return null;
  }
  const raw = Buffer.from(publicKeyBase64Url, "base64url");
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Derive the 64-character lowercase hex SHA-256 `kid` from a base64url raw 32-byte Ed25519 public key.
 * Throws if the public key is not a valid 32-byte base64url key.
 */
export function deriveKid(publicKeyBase64Url: string): string {
  const kid = tryDeriveKid(publicKeyBase64Url);
  if (kid === null) {
    throw new Error("Invalid raw 32-byte base64url Ed25519 public key.");
  }
  return kid;
}

function createEd25519PrivateKeyFromSeedHex(seedHex: string): KeyObject {
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
    throw new Error("Ed25519 private seed must be 64 hex characters (32 bytes).");
  }
  const seed = Buffer.from(seedHex, "hex");
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

function createEd25519PublicKeyFromBase64Url(publicKeyBase64Url: string): KeyObject {
  if (!isValidPublicKeyBase64Url(publicKeyBase64Url)) {
    throw new Error("Invalid raw 32-byte base64url Ed25519 public key.");
  }
  const raw = Buffer.from(publicKeyBase64Url, "base64url");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

/**
 * Generate an Ed25519 key pair (or derive it deterministically from a 32-byte hex seed).
 */
export function generateEd25519KeyPair(seedHex?: string): Ed25519KeyPairMaterial {
  const resolvedSeedHex = (seedHex ?? randomBytes(32).toString("hex")).toLowerCase();
  const privKey = createEd25519PrivateKeyFromSeedHex(resolvedSeedHex);
  const pubDer = createPublicKey(privKey).export({ format: "der", type: "spki" }) as Buffer;
  const rawPub = pubDer.subarray(ED25519_SPKI_PREFIX.length);
  const publicKey = rawPub.toString("base64url");
  const kid = createHash("sha256").update(rawPub).digest("hex");
  return { seedHex: resolvedSeedHex, publicKey, kid };
}

/**
 * Validate the strict path grammar for signed requests (Ruling 3):
 * single-line ASCII starting with `/`, no query string (`?`), no `\r`/`\n` or
 * control characters, and no percent-encoded control bytes (`%00`..`%1f`, `%7f`).
 */
export function isValidRequestPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 2048) {
    return false;
  }
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) {
    return false;
  }
  if (path.includes("//") || path.includes("..")) {
    return false;
  }
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code >= 0x7f) {
      return false;
    }
  }
  if (PCT_CONTROL_RE.test(path)) {
    return false;
  }
  return true;
}

export function isValidRequestMethod(method: string): boolean {
  return METHOD_RE.test(method);
}

export function isValidTimestampHeader(timestamp: string): boolean {
  if (!TIMESTAMP_RE.test(timestamp)) {
    return false;
  }
  return !Number.isNaN(Date.parse(timestamp));
}

export function isValidNonceHeader(nonce: string): boolean {
  return NONCE_RE.test(nonce);
}

export function isValidAgentIdHeader(agentId: string): boolean {
  return AGENT_ID_RE.test(agentId);
}

export function isValidKeyIdHeader(keyId: string): boolean {
  return KID_HEX_RE.test(keyId);
}

export function isValidSignatureHeader(signature: string): boolean {
  if (!SIGNATURE_B64URL_RE.test(signature)) {
    return false;
  }
  const raw = Buffer.from(signature, "base64url");
  return raw.length === 64 && raw.toString("base64url") === signature;
}

/**
 * Build the 8-line `cognate-request-v1` canonical UTF-8 string (`\n`-joined, no trailing newline).
 */
export function buildCanonicalRequestString(fields: CanonicalRequestFields): string {
  return [
    "cognate-request-v1",
    fields.method,
    fields.path,
    fields.bodySha256,
    fields.timestamp,
    fields.nonce,
    fields.agentId,
    fields.keyId,
  ].join("\n");
}

/**
 * Compute the lowercase hex SHA-256 digest of raw body bytes.
 */
export function sha256HexBytes(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Sign a canonical `cognate-request-v1` string with a 32-byte Ed25519 private seed (hex),
 * returning the 86-character base64url signature.
 */
export function signCanonicalRequest(canonical: string, seedHex: string): string {
  const privKey = createEd25519PrivateKeyFromSeedHex(seedHex);
  return sign(null, Buffer.from(canonical, "utf8"), privKey).toString("base64url");
}

/**
 * Verify an Ed25519 base64url signature over a canonical `cognate-request-v1` string.
 */
export function verifyCanonicalRequestSignature(
  canonical: string,
  signatureBase64Url: string,
  publicKeyBase64Url: string,
): boolean {
  if (!isValidSignatureHeader(signatureBase64Url) || !isValidPublicKeyBase64Url(publicKeyBase64Url)) {
    return false;
  }
  try {
    const pubKey = createEd25519PublicKeyFromBase64Url(publicKeyBase64Url);
    const sigBytes = Buffer.from(signatureBase64Url, "base64url");
    return verify(null, Buffer.from(canonical, "utf8"), pubKey, sigBytes);
  } catch {
    return false;
  }
}

/**
 * Serialize a JSON value using RFC 8785 JSON Canonicalization Scheme (JCS).
 */
export function canonicalizeJsonBody(value: unknown): string {
  return canonicalize(value);
}

/**
 * Verify that raw UTF-8 request body bytes match the RFC 8785 JCS canonicalization of the parsed JSON value.
 */
export function isJcsCanonicalJsonBytes(rawBytes: Buffer, parsed: unknown): boolean {
  try {
    const jcs = canonicalize(parsed);
    return rawBytes.equals(Buffer.from(jcs, "utf8"));
  } catch {
    return false;
  }
}

/**
 * In-memory replay store keyed by `${agentId}:${nonce}` -> expiry timestamp (ms).
 *
 * Nonces are checked read-only before signature verification, inserted only after
 * signature verification succeeds, and retained until `max(now, timestamp) + 300 s`
 * (covering the full 600 s validity span, Ruling 4).
 */
export interface ReplayStore {
  hasSeen(agentId: string, nonce: string, nowMs?: number): boolean;
  recordVerified(agentId: string, nonce: string, timestampMs: number, nowMs?: number): void;
  size(): number;
}

export function createReplayStore(windowMs: number = TIMESTAMP_WINDOW_MS): ReplayStore {
  const entries = new Map<string, number>();

  function prune(nowMs: number): void {
    for (const [key, expiryMs] of entries) {
      if (expiryMs <= nowMs) {
        entries.delete(key);
      }
    }
  }

  return {
    hasSeen(agentId: string, nonce: string, nowMs = Date.now()): boolean {
      prune(nowMs);
      const key = `${agentId}:${nonce}`;
      const expiryMs = entries.get(key);
      return expiryMs !== undefined && expiryMs > nowMs;
    },
    recordVerified(agentId: string, nonce: string, timestampMs: number, nowMs = Date.now()): void {
      prune(nowMs);
      const key = `${agentId}:${nonce}`;
      const expiryMs = Math.max(nowMs, timestampMs) + windowMs;
      entries.set(key, expiryMs);
    },
    size(): number {
      return entries.size;
    },
  };
}

const DEFAULT_TENANT_ROOTS: readonly TenantRootKeyEntry[] = [
  {
    tenantId: "tenant-a" as TenantId,
    kid: "6e676438555d5783c9197c1ad0f7ffd21d30c017f3bc882014c90756d91224e3",
    publicKey: "OU0e1p_4rG9FqAHKkPob3VddG3eBEbRs55JR2wL5TIM",
    actorId: "sha256:1eb2c7ffd32e6a9291cd4efd2299924762626ee55c1735389964d32cfde7d9e4" as ActorId,
  },
  {
    tenantId: "tenant-b" as TenantId,
    kid: "e86478cb0dda167def172760eb69c635497dd3cfe3bc9849388f96ffdc6804f7",
    publicKey: "Ts-MTztMri3vSZwiT87kz0E0CduYsTBJUxA590z8rf8",
    actorId: "sha256:1db260dbecd1661cad913d91cffac9b0e6a599a6473888018f2e7faf6f60cf9e" as ActorId,
  },
  {
    tenantId: "tenant-1" as TenantId,
    kid: "0da1ca464230a946934b3cb540780cd8e373c09ed91ddbee6b11d61c2db93b82",
    publicKey: "XzDwr56hT5N-BEz1XsGDqUY-SMPIrxA0sQRNcdztqZw",
    actorId: "sha256:fb8a82c25f25e5586111c11392f74b608a3d7788ae017297400c162f6b37b8ba" as ActorId,
  },
  {
    tenantId: "tenant-2" as TenantId,
    kid: "e6eefe189d71d2af2de1fe3123f3883a1610c4b5b34ec7ef1ef362f8e7469633",
    publicKey: "PHwYzQeINX-FOqVtLbBGHEFQZilra0h9o05jGe9JATY",
    actorId: "sha256:d5a7dfe09d6ca55a4ee382cb089b33dc70485b293dcb0f35d2b86834636b5c1d" as ActorId,
  },
  {
    tenantId: "tenant-alpha" as TenantId,
    kid: "01b22dc4dd2b83d4836864d3d3bdbf3e6114e45f1e8edf02a4eced96a6f14555",
    publicKey: "wXHOClpUcO09oocF1mM-GVMiIC9DDstjgJBmv2uaAxo",
    actorId: "sha256:c70c67b6cee5e2a167656c35bc615ecb001709480eff4b34da0543c0ec87196f" as ActorId,
  },
  {
    tenantId: "tenant-beta" as TenantId,
    kid: "afffb6117780b291348a9b7c9a072bb01b471b299cdad962ce026039889d3242",
    publicKey: "f3PKS9p8V_0FqPKUmoEtAk1QswiVMTjtOZW-b4uCIyA",
    actorId: "sha256:742b8e311ea85dab19409e927073b9478b9deb20775218c1e866ee67477dde83" as ActorId,
  },
  {
    tenantId: "default" as TenantId,
    kid: "4d5c89eb76af7048bac488dbeb352e183a0d75002eaab7cbdc1dbcb2353494b0",
    publicKey: "BwcSEoeZUWKnWTcO4MbJisHEfBBcjqcVApWS3TKvizI",
    actorId: "sha256:ee221f2b46886aeccbb6bc461e83023a6107ffa1aa0b997515f16870ad3c9f2b" as ActorId,
  },
];

export function validateTenantRootsList(roots: readonly TenantRootKeyEntry[]): readonly TenantRootKeyEntry[] {
  const seenTenants = new Set<string>();
  for (const entry of roots) {
    if (!entry || typeof entry.tenantId !== "string" || entry.tenantId.trim().length === 0) {
      throw new Error("Invalid tenant root config: tenantId must be a non-empty string.");
    }
    if (seenTenants.has(entry.tenantId)) {
      throw new Error(`Invalid tenant root config: duplicate tenantId "${entry.tenantId}".`);
    }
    seenTenants.add(entry.tenantId);
    const derived = tryDeriveKid(entry.publicKey);
    if (derived === null) {
      throw new Error(`Invalid tenant root config for "${entry.tenantId}": malformed Ed25519 publicKey.`);
    }
    if (entry.kid !== derived) {
      throw new Error(
        `Invalid tenant root config for "${entry.tenantId}": kid "${entry.kid}" does not match sha256(publicKey) "${derived}".`,
      );
    }
    if (typeof entry.actorId !== "string" || !isValidAgentIdHeader(entry.actorId)) {
      throw new Error(`Invalid tenant root config for "${entry.tenantId}": invalid actorId.`);
    }
  }
  return roots;
}

/**
 * Load and verify the committed per-tenant root key configuration.
 */
export function loadTenantRootsConfig(configPath?: string): readonly TenantRootKeyEntry[] {
  if (configPath !== undefined) {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as TenantRootsConfig;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.roots)) {
      throw new Error(`Invalid tenant roots config at "${configPath}".`);
    }
    return validateTenantRootsList(parsed.roots);
  }
  const moduleDir = fileURLToPath(new URL(".", import.meta.url));
  const candidatePaths = [
    resolve(moduleDir, "../../config/tenant-roots.json"),
    resolve(process.cwd(), "packages/node/config/tenant-roots.json"),
  ];
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as TenantRootsConfig;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.roots)) {
        throw new Error(`Invalid tenant roots config at "${candidate}".`);
      }
      return validateTenantRootsList(parsed.roots);
    }
  }
  return validateTenantRootsList(DEFAULT_TENANT_ROOTS);
}

/**
 * Validate `signedRequests` mode and `signedRequestsLogUntil` sunset at startup (Ruling 7).
 */
export function validateSignedRequestsConfig(
  mode: SignedRequestsMode = "enforce",
  logUntil?: string,
  nowMs: number = Date.now(),
): { readonly mode: SignedRequestsMode; readonly logUntilMs: number | null } {
  if (mode !== "enforce" && mode !== "log") {
    throw new Error(
      `Invalid signedRequests mode ${JSON.stringify(mode)}: must be "enforce" or "log".`,
    );
  }
  if (mode === "enforce") {
    return { mode: "enforce", logUntilMs: null };
  }
  if (typeof logUntil !== "string" || !isValidTimestampHeader(logUntil)) {
    throw new Error(
      'signedRequests: "log" requires signedRequestsLogUntil set to a strict RFC 3339 UTC timestamp.',
    );
  }
  const logUntilMs = Date.parse(logUntil);
  if (logUntilMs <= nowMs) {
    throw new Error(
      `signedRequestsLogUntil (${logUntil}) must be in the future when starting in "log" mode.`,
    );
  }
  if (logUntilMs - nowMs > MAX_LOG_MODE_SUNSET_MS) {
    throw new Error(
      `signedRequestsLogUntil (${logUntil}) cannot be more than 14 days in the future.`,
    );
  }
  return { mode: "log", logUntilMs };
}

/**
 * Parse `signedRequests` and `signedRequestsLogUntil` from environment variables.
 */
export function signedRequestsConfigFromEnv(
  env: Record<string, string | undefined>,
  nowMs: number = Date.now(),
): { readonly signedRequests: SignedRequestsMode; readonly signedRequestsLogUntil?: string } {
  const rawMode = env.COGNATE_SIGNED_REQUESTS?.trim();
  const mode = (rawMode === undefined || rawMode === "" ? "enforce" : rawMode) as SignedRequestsMode;
  const logUntil = env.COGNATE_SIGNED_REQUESTS_LOG_UNTIL?.trim();
  validateSignedRequestsConfig(mode, logUntil, nowMs);
  return {
    signedRequests: mode,
    ...(logUntil ? { signedRequestsLogUntil: logUntil } : {}),
  };
}

export interface VerifiedPrincipal {
  readonly agentId: ActorId;
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
  readonly kid: string | null;
  readonly principal: PrincipalKind;
  readonly isTenantRoot: boolean;
  readonly unsigned: boolean;
  readonly agent?: Agent;
}

export type SignatureAuthResult =
  | { readonly ok: true; readonly principal: VerifiedPrincipal }
  | { readonly ok: false; readonly reason: string };

/**
 * Verify a request against the identity state and per-tenant root keys.
 *
 * Verification order (refusing with uniform 401 on any failure):
 * 1. Headers present and match strict single-line ASCII grammar; path valid (no query string or control bytes).
 * 2. Principal exists and is active (registered active agent or configured tenant root key).
 * 3. `X-Key-Id` matches the principal's current active key (and is not in `revokedKids`).
 * 4. `X-Timestamp` is within ±300 s of server time.
 * 5. `(agentId, nonce)` is unseen in the replay store (read-only check before signature verification).
 * 6. Ed25519 signature over the 8-line `cognate-request-v1` canonical byte string is valid.
 * 7. `(agentId, nonce)` is recorded in the replay store with 600 s span retention.
 */
export function verifySignedRequest(params: {
  readonly method: string;
  readonly rawUrl: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBody: Buffer;
  readonly identity: IdentityRegistryState;
  readonly tenantRoots: readonly TenantRootKeyEntry[];
  readonly replayStore: ReplayStore;
  readonly mode: SignedRequestsMode;
  readonly logUntilMs: number | null;
  readonly nowMs?: number;
  readonly onLogModeWarning?: (entry: {
    readonly method: string;
    readonly pathname: string;
    readonly agentId: string;
    readonly code: string;
  }) => void;
}): SignatureAuthResult {
  const nowMs = params.nowMs ?? Date.now();
  const { method, rawUrl, headers, rawBody, identity, tenantRoots, replayStore } = params;

  if (!isValidRequestMethod(method)) {
    return { ok: false, reason: "invalid-method" };
  }
  if (!isValidRequestPath(rawUrl)) {
    return { ok: false, reason: "invalid-path" };
  }
  if (method === "GET" && rawBody.length > 0) {
    return { ok: false, reason: "get-with-body" };
  }

  const agentIdHeader = headers["x-agent-id"];
  const timestampHeader = headers["x-timestamp"];
  const nonceHeader = headers["x-nonce"];
  const keyIdHeader = headers["x-key-id"];
  const signatureHeader = headers["x-signature"];

  if (typeof agentIdHeader !== "string" || !isValidAgentIdHeader(agentIdHeader)) {
    return { ok: false, reason: "missing-or-invalid-agent-id" };
  }
  if (typeof timestampHeader !== "string" || !isValidTimestampHeader(timestampHeader)) {
    return { ok: false, reason: "missing-or-invalid-timestamp" };
  }

  const timestampMs = Date.parse(timestampHeader);
  const hasAnySignatureHeader =
    nonceHeader !== undefined || keyIdHeader !== undefined || signatureHeader !== undefined;
  const isIdentityRoute = rawUrl === "/identity" || rawUrl.startsWith("/identity/");

  // Check if request is unsigned and eligible for sunset-gated `log` mode (Ruling 7)
  if (!hasAnySignatureHeader) {
    if (params.mode !== "log" || isIdentityRoute) {
      return { ok: false, reason: "missing-signature-headers" };
    }
    if (params.logUntilMs === null || nowMs >= params.logUntilMs) {
      return { ok: false, reason: "log-mode-sunset-expired" };
    }
    if (Math.abs(nowMs - timestampMs) > TIMESTAMP_WINDOW_MS) {
      return { ok: false, reason: "stale-timestamp" };
    }
    const agent = getAgent(identity, agentIdHeader as ActorId);
    if (!agent) {
      return { ok: false, reason: "unknown-agent" };
    }
    if (agent.status !== "active") {
      return { ok: false, reason: "inactive-agent" };
    }
    params.onLogModeWarning?.({
      method,
      pathname: rawUrl,
      agentId: agentIdHeader,
      code: "auth.unsigned-request-logged",
    });
    return {
      ok: true,
      principal: {
        agentId: agent.id,
        actorId: agent.id,
        tenantId: agent.tenantId,
        kid: null,
        principal: agent.principal ?? "agent",
        isTenantRoot: false,
        unsigned: true,
        agent,
      },
    };
  }

  // Step 1: Strict header grammar check
  if (
    typeof nonceHeader !== "string" ||
    !isValidNonceHeader(nonceHeader) ||
    typeof keyIdHeader !== "string" ||
    !isValidKeyIdHeader(keyIdHeader) ||
    typeof signatureHeader !== "string" ||
    !isValidSignatureHeader(signatureHeader)
  ) {
    return { ok: false, reason: "malformed-signature-headers" };
  }

  // Step 2 & 3: Principal lookup and active key (`kid`) verification
  let publicKeyBase64Url: string | null = null;
  let resolvedPrincipal: Omit<VerifiedPrincipal, "unsigned"> | null = null;

  const agent = getAgent(identity, agentIdHeader as ActorId);
  if (agent) {
    if (agent.status !== "active") {
      return { ok: false, reason: "inactive-agent" };
    }
    if (agent.publicKey === null || !isValidPublicKeyBase64Url(agent.publicKey)) {
      return { ok: false, reason: "missing-or-invalid-agent-public-key" };
    }
    if (agent.revokedKids?.includes(keyIdHeader)) {
      return { ok: false, reason: "revoked-kid" };
    }
    const expectedKid = agent.kid ?? tryDeriveKid(agent.publicKey);
    if (expectedKid === null || expectedKid !== keyIdHeader) {
      return { ok: false, reason: "kid-mismatch" };
    }
    publicKeyBase64Url = agent.publicKey;
    resolvedPrincipal = {
      agentId: agent.id,
      actorId: agent.id,
      tenantId: agent.tenantId,
      kid: keyIdHeader,
      principal: agent.principal ?? "agent",
      isTenantRoot: false,
      agent,
    };
  } else {
    const rootEntry = tenantRoots.find((r) => r.actorId === agentIdHeader);
    if (!rootEntry) {
      return { ok: false, reason: "unknown-principal" };
    }
    if (rootEntry.kid !== keyIdHeader) {
      return { ok: false, reason: "root-kid-mismatch" };
    }
    publicKeyBase64Url = rootEntry.publicKey;
    resolvedPrincipal = {
      agentId: rootEntry.actorId,
      actorId: rootEntry.actorId,
      tenantId: rootEntry.tenantId,
      kid: rootEntry.kid,
      principal: "human",
      isTenantRoot: true,
    };
  }

  // Step 4: Timestamp within ±300 s of server time
  if (Math.abs(nowMs - timestampMs) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, reason: "stale-timestamp" };
  }

  // Step 5: Read-only nonce check in replay store before signature verification (Ruling 4)
  if (replayStore.hasSeen(agentIdHeader, nonceHeader, nowMs)) {
    return { ok: false, reason: "replay-detected" };
  }

  // Step 6: Ed25519 signature verification over 8-line `cognate-request-v1` canonical string
  const bodySha256 = rawBody.length === 0 ? EMPTY_BODY_SHA256 : sha256HexBytes(rawBody);
  const canonical = buildCanonicalRequestString({
    method,
    path: rawUrl,
    bodySha256,
    timestamp: timestampHeader,
    nonce: nonceHeader,
    agentId: agentIdHeader,
    keyId: keyIdHeader,
  });

  if (!verifyCanonicalRequestSignature(canonical, signatureHeader, publicKeyBase64Url)) {
    return { ok: false, reason: "invalid-signature" };
  }

  // Step 7: Record `(agentId, nonce)` in replay store only after signature verifies (Ruling 4)
  replayStore.recordVerified(agentIdHeader, nonceHeader, timestampMs, nowMs);

  return {
    ok: true,
    principal: {
      ...resolvedPrincipal,
      unsigned: false,
    },
  };
}
