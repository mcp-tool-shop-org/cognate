/**
 * Node Client Signing Helper for `cognate-request-v1`
 *
 * Canonicalizes request bodies with RFC 8785 JCS, signs requests with Ed25519,
 * corrects clock offset from `GET /health`'s `serverTime`, and retries once on
 * a `401 auth.unauthenticated` response (Settled Q2, Amendment A3).
 */

import { randomBytes } from "node:crypto";
import {
  EMPTY_BODY_SHA256,
  buildCanonicalRequestString,
  canonicalizeJsonBody,
  generateEd25519KeyPair,
  sha256HexBytes,
  signCanonicalRequest,
} from "./middleware/signature.js";

export interface SignHttpRequestParams {
  readonly method?: "GET" | "POST";
  readonly path: string;
  readonly agentId: string;
  readonly seedHex: string;
  readonly kid?: string;
  readonly body?: unknown;
  readonly rawBodyOverride?: string;
  readonly timestamp?: string;
  readonly nonce?: string;
  readonly clockOffsetMs?: number;
  readonly nowMs?: number;
  readonly headerOverrides?: Readonly<Record<string, string>>;
}

export interface SignedHttpRequest {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly rawBody: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly kid: string;
  readonly signature: string;
  readonly headers: Record<string, string>;
  readonly init: RequestInit;
}

/**
 * Construct a signed `cognate-request-v1` HTTP request with JCS-canonical body and Ed25519 headers.
 */
export function signHttpRequest(params: SignHttpRequestParams): SignedHttpRequest {
  const method = params.method ?? (params.body !== undefined || params.rawBodyOverride !== undefined ? "POST" : "GET");
  const keyMaterial = generateEd25519KeyPair(params.seedHex);
  const kid = params.kid ?? keyMaterial.kid;
  const baseNow = params.nowMs ?? Date.now();
  const timestamp =
    params.timestamp ?? new Date(baseNow + (params.clockOffsetMs ?? 0)).toISOString();
  const nonce = params.nonce ?? randomBytes(16).toString("base64url");

  const rawBody =
    params.rawBodyOverride !== undefined
      ? params.rawBodyOverride
      : method === "POST"
        ? canonicalizeJsonBody(params.body ?? {})
        : "";

  const bodyBytes = Buffer.from(rawBody, "utf8");
  const bodySha256 = bodyBytes.length === 0 ? EMPTY_BODY_SHA256 : sha256HexBytes(bodyBytes);

  const canonical = buildCanonicalRequestString({
    method,
    path: params.path,
    bodySha256,
    timestamp,
    nonce,
    agentId: params.agentId,
    keyId: kid,
  });

  const signature = signCanonicalRequest(canonical, params.seedHex);
  const headers: Record<string, string> = {
    "X-Agent-Id": params.agentId,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Key-Id": kid,
    "X-Signature": signature,
    ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    ...(params.headerOverrides ?? {}),
  };

  return {
    method,
    path: params.path,
    rawBody,
    timestamp,
    nonce,
    kid,
    signature,
    headers,
    init: {
      method,
      headers,
      ...(method === "POST" ? { body: rawBody } : {}),
    },
  };
}

export interface SignedClientOptions {
  readonly baseUrl: string;
  readonly agentId: string;
  readonly seedHex: string;
  readonly kid?: string;
  readonly fetchImpl?: typeof fetch;
  readonly nowFn?: () => number;
}

export interface SignedClientRequestOptions {
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  readonly rawBodyOverride?: string;
  readonly timestamp?: string;
  readonly nonce?: string;
  readonly headerOverrides?: Readonly<Record<string, string>>;
}

export interface SignedClient {
  readonly syncClock: () => Promise<number>;
  readonly getClockOffsetMs: () => number;
  readonly request: (path: string, opts?: SignedClientRequestOptions) => Promise<Response>;
}

/**
 * Create a Node client signing helper that corrects clock offset from `GET /health`'s
 * `serverTime` and retries once on any `401` response.
 */
export function createSignedClient(options: SignedClientOptions): SignedClient {
  const fetchFn = options.fetchImpl ?? fetch;
  const nowFn = options.nowFn ?? (() => Date.now());
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  let clockOffsetMs = 0;

  async function syncClock(): Promise<number> {
    const res = await fetchFn(`${baseUrl}/health`, { method: "GET" });
    if (res.ok) {
      const payload = (await res.json()) as { serverTime?: string };
      if (typeof payload.serverTime === "string") {
        const serverMs = Date.parse(payload.serverTime);
        if (!Number.isNaN(serverMs)) {
          clockOffsetMs = serverMs - nowFn();
        }
      }
    }
    return clockOffsetMs;
  }

  async function request(path: string, opts: SignedClientRequestOptions = {}): Promise<Response> {
    const firstSigned = signHttpRequest({
      method: opts.method,
      path,
      agentId: options.agentId,
      seedHex: options.seedHex,
      kid: options.kid,
      body: opts.body,
      rawBodyOverride: opts.rawBodyOverride,
      timestamp: opts.timestamp,
      nonce: opts.nonce,
      clockOffsetMs,
      nowMs: nowFn(),
      headerOverrides: opts.headerOverrides,
    });

    const firstRes = await fetchFn(`${baseUrl}${path}`, firstSigned.init);
    if (firstRes.status !== 401) {
      return firstRes;
    }

    // Consume first response body if unread, re-read `/health` `serverTime`, and retry once
    await syncClock();

    const retrySigned = signHttpRequest({
      method: opts.method,
      path,
      agentId: options.agentId,
      seedHex: options.seedHex,
      kid: options.kid,
      body: opts.body,
      rawBodyOverride: opts.rawBodyOverride,
      clockOffsetMs,
      nowMs: nowFn(),
      headerOverrides: opts.headerOverrides,
    });

    return fetchFn(`${baseUrl}${path}`, retrySigned.init);
  }

  return {
    syncClock,
    getClockOffsetMs: () => clockOffsetMs,
    request,
  };
}
