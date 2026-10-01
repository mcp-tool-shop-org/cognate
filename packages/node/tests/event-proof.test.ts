import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonlEventStore, type StoredEvent } from "@mcptoolshop/attestia/event-store";
import { hashAttestation, MerkleTree, type MerkleProof } from "@mcptoolshop/attestia/proof";
import { createRegistry as createIdentityRegistry, registerAgent } from "@cognate/agent-identity";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createStore as createPromptStore } from "@cognate/prompt-store";
import { proveRecordedEvent } from "../src/event-proof.js";
import { createCognateServer } from "../src/server.js";

const TIMESTAMP = "2026-10-01T12:00:00Z";

function stored(fields: {
  eventId: string;
  streamId: string;
  globalPosition: number;
  payload?: Record<string, unknown>;
}): StoredEvent {
  return {
    event: {
      type: "cognate.policy.evaluated",
      metadata: {
        eventId: fields.eventId,
        timestamp: TIMESTAMP,
        actor: "actor-1",
        correlationId: "policy-1",
        source: "external",
      },
      payload: fields.payload ?? { policyId: "policy-1", overall: "deny" },
    },
    streamId: fields.streamId,
    version: fields.globalPosition,
    globalPosition: fields.globalPosition,
    appendedAt: TIMESTAMP,
  };
}

describe("proveRecordedEvent", () => {
  it("proves each event in the log against one root", () => {
    const events = [
      stored({ eventId: "e-2", streamId: "cognate-tenant-1-policy", globalPosition: 2, payload: { policyId: "later" } }),
      stored({ eventId: "e-1", streamId: "cognate-tenant-1-releases", globalPosition: 1, payload: { release: "1.2.3" } }),
    ];
    const first = proveRecordedEvent(events, "e-1", "tenant-1");
    const second = proveRecordedEvent(events, "e-2", "tenant-1");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.root).toBe(second.root);
    expect(first.leafCount).toBe(2);
    expect(first.proof.leafIndex).toBe(0);
    expect(second.proof.leafIndex).toBe(1);
    expect(first.proof.leafHash).toBe(hashAttestation(first.event));
    expect(MerkleTree.verifyProof(first.proof)).toBe(true);
    expect(MerkleTree.verifyProof(second.proof)).toBe(true);
    expect(first.event.payload).toEqual({ release: "1.2.3" });
    expect(JSON.stringify(first)).not.toContain("later");
  });

  it("misses an id that is not in the log", () => {
    const result = proveRecordedEvent(
      [stored({ eventId: "e-1", streamId: "cognate-tenant-1-policy", globalPosition: 1 })],
      "missing",
      "tenant-1",
    );
    expect(result).toEqual({ ok: false, code: "attestia.event-not-found" });
  });

  it("misses an event recorded for another tenant", () => {
    const result = proveRecordedEvent(
      [stored({ eventId: "e-1", streamId: "cognate-tenant-2-policy", globalPosition: 1, payload: { policyId: "secret-policy" } })],
      "e-1",
      "tenant-1",
    );
    expect(result).toEqual({ ok: false, code: "attestia.event-not-found" });
  });

  it("does not prove an id that appears twice", () => {
    const result = proveRecordedEvent(
      [
        stored({ eventId: "e-1", streamId: "cognate-tenant-1-policy", globalPosition: 1 }),
        stored({ eventId: "e-1", streamId: "cognate-tenant-1-releases", globalPosition: 2 }),
      ],
      "e-1",
      "tenant-1",
    );
    expect(result).toEqual({ ok: false, code: "attestia.event-ambiguous" });
  });

  it("withholds an event whose payload holds prompt text", () => {
    const result = proveRecordedEvent(
      [stored({
        eventId: "e-1",
        streamId: "cognate-tenant-1-prompts",
        globalPosition: 1,
        payload: { promptText: "What is your password?", plaintextHash: "hash1" },
      })],
      "e-1",
      "tenant-1",
    );
    expect(result).toEqual({ ok: false, code: "attestia.event-withheld" });
  });

  it("does not prove a log whose positions have a gap", () => {
    const result = proveRecordedEvent(
      [
        stored({ eventId: "e-1", streamId: "cognate-tenant-1-policy", globalPosition: 1 }),
        stored({ eventId: "e-2", streamId: "cognate-tenant-1-policy", globalPosition: 3 }),
      ],
      "e-1",
      "tenant-1",
    );
    expect(result).toEqual({ ok: false, code: "attestia.proof-failed" });
  });
});

function stateFor(agents: Array<{ id: string; tenantId: string }>) {
  let identity = createIdentityRegistry();
  for (const agent of agents) {
    const registered = registerAgent(identity, {
      id: agent.id,
      tenantId: agent.tenantId,
      name: agent.id,
      owner: "human-1",
      walletAddress: null,
      publicKey: null,
      capabilities: [],
      createdAt: TIMESTAMP,
      status: "active",
    });
    if (registered.ok) identity = registered.state;
  }
  return {
    registry: createModelRegistry(),
    identity,
    prompts: createPromptStore(),
  };
}

function policyBody(promptText: string) {
  return {
    policy: {
      id: "policy-1",
      tenantId: "tenant-1",
      name: "Block Passwords",
      version: 1,
      rules: [{
        id: "rule-1",
        type: "content-filter",
        target: { kind: "global" },
        condition: { kind: "keyword", words: ["password"] },
        action: "deny",
        severity: "block",
      }],
      createdAt: TIMESTAMP,
      approvedBy: "admin-1",
      status: "active",
    },
    context: {
      tenantId: "tenant-1",
      actorId: "actor-1",
      modelVersionId: "v1",
      agentId: null,
      timestamp: TIMESTAMP,
      promptText,
      outputText: null,
      metadata: { tokensIn: 3, tokensOut: null, latencyMs: null, confidence: null, finishReason: null, tags: [] },
      agentCapabilities: [],
      counters: { callsInWindow: 1, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
    },
  };
}

async function listen(ctx: Parameters<typeof createCognateServer>[0]) {
  const { server } = createCognateServer(ctx);
  return new Promise<{ port: number; stop: () => void }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({ port, stop: () => server.close() });
    });
  });
}

async function fetchJson(
  port: number,
  path: string,
  opts?: { method?: string; body?: unknown; agentId?: string },
) {
  const headers: Record<string, string> = {};
  if (opts?.body) headers["Content-Type"] = "application/json";
  if (opts?.agentId) {
    headers["X-Agent-Id"] = opts.agentId;
    headers["X-Timestamp"] = TIMESTAMP;
  }
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: opts?.method ?? "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as Record<string, unknown>, text };
  } catch {
    return { status: res.status, json: {} as Record<string, unknown>, text };
  }
}

function expectVerified(json: Record<string, unknown>, eventId: string): void {
  const proof = json.proof as MerkleProof;
  expect(proof.leafHash).toBe(hashAttestation(json.event));
  expect(proof.root).toBe(json.root);
  expect(MerkleTree.verifyProof(proof)).toBe(true);
  expect((json.event as { metadata: { eventId: string } }).metadata.eventId).toBe(eventId);
}

describe("GET /events/:eventId", () => {
  it("returns an Attestia inclusion proof for the event the call recorded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognate-proof-"));
    const eventStore = new JsonlEventStore({ filePath: join(dir, "events.jsonl") });
    let releaseChecks = 0;
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-1", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore,
      verifyRelease: async () => {
        releaseChecks += 1;
        return { status: "PASS" };
      },
    });
    try {
      const posted = await fetchJson(port, "/policy/evaluate", {
        method: "POST",
        agentId: "proof-agent-1",
        body: policyBody("What is your password?"),
      });
      expect(posted.status).toBe(200);
      const eventId = posted.json.eventId as string;
      const proved = await fetchJson(port, `/events/${eventId}`, { agentId: "proof-agent-1" });
      expect(proved.status).toBe(200);
      expectVerified(proved.json, eventId);
      expect(proved.json.leafCount).toBe(1);
      expect(proved.json.event).toMatchObject({
        type: "cognate.policy.evaluated",
        payload: { overall: "deny", policyId: "policy-1" },
      });
      expect(proved.text).not.toContain("What is your password?");
      expect(proved.json.event).not.toHaveProperty("promptText");

      const again = await fetchJson(port, "/policy/evaluate", {
        method: "POST",
        agentId: "proof-agent-1",
        body: policyBody("What is your password?"),
      });
      const secondId = again.json.eventId as string;
      const firstAfter = await fetchJson(port, `/events/${eventId}`, { agentId: "proof-agent-1" });
      const second = await fetchJson(port, `/events/${secondId}`, { agentId: "proof-agent-1" });
      expectVerified(firstAfter.json, eventId);
      expectVerified(second.json, secondId);
      expect(firstAfter.json.root).toBe(second.json.root);
      expect(firstAfter.json.root).not.toBe(proved.json.root);
      expect(firstAfter.json.leafCount).toBe(2);
      expect(releaseChecks).toBe(0);
    } finally {
      stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("misses an unknown id and returns no proof", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognate-proof-"));
    const eventStore = new JsonlEventStore({ filePath: join(dir, "events.jsonl") });
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-miss", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore,
    });
    try {
      const { status, json } = await fetchJson(port, "/events/missing-event", { agentId: "proof-agent-miss" });
      expect(status).toBe(404);
      expect(json.code).toBe("attestia.event-not-found");
      expect(json).not.toHaveProperty("proof");
      expect(json).not.toHaveProperty("event");
    } finally {
      stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires the agent headers", async () => {
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-auth", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore: { append() { return { streamId: "x", fromVersion: 1, toVersion: 1, count: 1 }; } },
    });
    try {
      const { status, json } = await fetchJson(port, "/events/e-1");
      expect(status).toBe(401);
      expect(json.error).toBe("auth.missing-credentials");
      expect(json).not.toHaveProperty("proof");
    } finally {
      stop();
    }
  });

  it("misses an event that belongs to another tenant", async () => {
    const events = [
      stored({
        eventId: "e-other",
        streamId: "cognate-tenant-2-policy",
        globalPosition: 1,
        payload: { policyId: "secret-policy", overall: "deny" },
      }),
    ];
    const { port, stop } = await listen({
      state: stateFor([
        { id: "proof-agent-tenant", tenantId: "tenant-1" },
        { id: "proof-agent-other", tenantId: "tenant-2" },
      ]),
      port: 0,
      host: "127.0.0.1",
      eventStore: {
        append() { return { streamId: "x", fromVersion: 1, toVersion: 1, count: 1 }; },
        readAll: () => events,
      },
    });
    try {
      const hidden = await fetchJson(port, "/events/e-other", { agentId: "proof-agent-tenant" });
      expect(hidden.status).toBe(404);
      expect(hidden.json.code).toBe("attestia.event-not-found");
      expect(hidden.text).not.toContain("secret-policy");
      expect(hidden.json).not.toHaveProperty("proof");

      const owner = await fetchJson(port, "/events/e-other", { agentId: "proof-agent-other" });
      expect(owner.status).toBe(200);
      expectVerified(owner.json, "e-other");
    } finally {
      stop();
    }
  });

  it("returns 503 and no proof when the log cannot be read", async () => {
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-noread", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore: {
        append() { return { streamId: "x", fromVersion: 1, toVersion: 1, count: 1 }; },
      },
    });
    try {
      const { status, json } = await fetchJson(port, "/events/e-1", { agentId: "proof-agent-noread" });
      expect(status).toBe(503);
      expect(json.code).toBe("attestia.read-not-configured");
      expect(json).not.toHaveProperty("proof");
    } finally {
      stop();
    }
  });

  it("returns 503 and no proof when the read throws", async () => {
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-throw", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore: {
        append() { return { streamId: "x", fromVersion: 1, toVersion: 1, count: 1 }; },
        readAll() { throw new Error("disk gone"); },
      },
    });
    try {
      const { status, json } = await fetchJson(port, "/events/e-1", { agentId: "proof-agent-throw" });
      expect(status).toBe(503);
      expect(json.code).toBe("attestia.read-failed");
      expect(json.message).toContain("disk gone");
      expect(json).not.toHaveProperty("proof");
    } finally {
      stop();
    }
  });

  it("withholds a stored event that contains prompt text", async () => {
    const events = [
      stored({
        eventId: "e-text",
        streamId: "cognate-tenant-1-prompts",
        globalPosition: 1,
        payload: { promptText: "super-secret-prompt", plaintextHash: "hash1" },
      }),
    ];
    const { port, stop } = await listen({
      state: stateFor([{ id: "proof-agent-withhold", tenantId: "tenant-1" }]),
      port: 0,
      host: "127.0.0.1",
      eventStore: {
        append() { return { streamId: "x", fromVersion: 1, toVersion: 1, count: 1 }; },
        readAll: () => events,
      },
    });
    try {
      const { status, json, text } = await fetchJson(port, "/events/e-text", { agentId: "proof-agent-withhold" });
      expect(status).toBe(503);
      expect(json.code).toBe("attestia.event-withheld");
      expect(json).not.toHaveProperty("proof");
      expect(text).not.toContain("super-secret-prompt");
    } finally {
      stop();
    }
  });
});
