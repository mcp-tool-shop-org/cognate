import { describe, expect, it, beforeEach } from "vitest";
import { extractCredentials, authenticate } from "../src/middleware/auth.js";
import { checkRateLimit, createRateLimitState } from "../src/middleware/rate-limit.js";
import type { IdentityRegistryState } from "@cognate/agent-identity";
import { createRegistry, registerAgent } from "@cognate/agent-identity";

function makeRequest(headers: Record<string, string>): import("http").IncomingMessage {
  return { headers } as import("http").IncomingMessage;
}

describe("auth middleware", () => {
  const now = "2026-09-28T12:00:00Z";
  let identity: IdentityRegistryState;

  beforeEach(() => {
    identity = createRegistry();
    identity = registerAgent(identity, {
      id: "agent-1",
      tenantId: "tenant-1",
      name: "Test",
      owner: "human-1",
      walletAddress: null,
      publicKey: null,
      capabilities: [{ id: "cap-1", kind: "inference", scope: { kind: "unlimited" }, constraints: [], grantedAt: now, grantedBy: "human-1", expiresAt: null }],
      createdAt: now,
      status: "active",
    }).state;
  });

  it("extracts credentials from headers", () => {
    const req = makeRequest({ "x-agent-id": "agent-1", "x-timestamp": now });
    const creds = extractCredentials(req);
    expect(creds).toEqual({ agentId: "agent-1", timestamp: now });
  });

  it("returns null for missing headers", () => {
    expect(extractCredentials(makeRequest({}))).toBeNull();
    expect(extractCredentials(makeRequest({ "x-agent-id": "agent-1" }))).toBeNull();
  });

  it("authenticates a valid agent", () => {
    const req = makeRequest({ "x-agent-id": "agent-1", "x-timestamp": now });
    const result = authenticate(req, { identityState: identity });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.agent.agentId).toBe("agent-1");
    }
  });

  it("rejects unknown agent", () => {
    const req = makeRequest({ "x-agent-id": "agent-2", "x-timestamp": now });
    const result = authenticate(req, { identityState: identity });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("auth.agent-not-found");
  });

  it("rejects missing credentials", () => {
    const req = makeRequest({});
    const result = authenticate(req, { identityState: identity });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("auth.missing-credentials");
  });
});

describe("rate limiting", () => {
  it("allows first request", () => {
    const state = createRateLimitState();
    const result = checkRateLimit(state, { maxTokens: 10, refillRate: 1 }, 1000);
    expect(result.allowed).toBe(true);
  });

  it("blocks when tokens exhausted", () => {
    let state = createRateLimitState();
    const config = { maxTokens: 2, refillRate: 0 };
    state = checkRateLimit(state, config, 1000).state;
    state = checkRateLimit(state, config, 1000).state;
    const result = checkRateLimit(state, config, 1000);
    expect(result.allowed).toBe(false);
  });

  it("refills tokens over time", () => {
    let state = createRateLimitState();
    const config = { maxTokens: 2, refillRate: 1 };
    state = checkRateLimit(state, config, 0).state;
    state = checkRateLimit(state, config, 0).state;
    const blocked = checkRateLimit(state, config, 0);
    expect(blocked.allowed).toBe(false);

    const afterRefill = checkRateLimit(state, config, 1500);
    expect(afterRefill.allowed).toBe(true);
  });
});
