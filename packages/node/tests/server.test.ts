import { describe, expect, it } from "vitest";
import { createCognateServer } from "../src/server.js";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";

async function startTestServer() {
  const { server } = createCognateServer({
    state: {
      registry: createModelRegistry(),
      identity: createIdentityRegistry(),
      prompts: createPromptStore(),
    },
    port: 0,
    host: "127.0.0.1",
  });

  return new Promise<{ port: number; stop: () => void }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({ port, stop: () => server.close() });
    });
  });
}

async function fetchJson(port: number, path: string, opts?: { method?: string; body?: unknown }) {
  const url = `http://127.0.0.1:${port}${path}`;
  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { status: res.status, json: text as unknown as Record<string, unknown> };
  }
}

describe("Cognate HTTP API", () => {
  it("returns health status", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/health");
      expect(status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.mode).toBe("api");
    } finally { stop(); }
  });

  it("returns 404 for unknown routes", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status } = await fetchJson(port, "/unknown");
      expect(status).toBe(404);
    } finally { stop(); }
  });

  it("POST /registry/models registers a model", async () => {
    const { port, stop } = await startTestServer();
    try {
      const model = {
        id: "m1", tenantId: "tenant-1", name: "Test Model", description: "A test model",
        architecture: "transformer", createdAt: "2026-09-28T12:00:00Z",
        owner: "human-1", currentVersion: null, status: "active",
      };
      const { status, json } = await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      expect(status).toBe(200);
      expect(json.id).toBe("m1");
    } finally { stop(); }
  });

  it("POST /registry/models fails for duplicate", async () => {
    const { port, stop } = await startTestServer();
    try {
      const model = {
        id: "m1", tenantId: "tenant-1", name: "Test Model", description: "A test model",
        architecture: "transformer", createdAt: "2026-09-28T12:00:00Z",
        owner: "human-1", currentVersion: null, status: "active",
      };
      await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      const { status, json } = await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      expect(status).toBe(400);
      expect(json.code).toBe("MODEL_ALREADY_EXISTS");
    } finally { stop(); }
  });

  it("POST /identity/agents registers an agent", async () => {
    const { port, stop } = await startTestServer();
    try {
      const agent = {
        id: "agent-1", tenantId: "tenant-1", name: "Test Agent", owner: "human-1",
        walletAddress: null, publicKey: null, capabilities: [],
        createdAt: "2026-09-28T12:00:00Z", status: "active",
      };
      const { status, json } = await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      expect(status).toBe(201);
      expect(json.id).toBe("agent-1");
    } finally { stop(); }
  });

  it("POST /identity/agents fails for duplicate", async () => {
    const { port, stop } = await startTestServer();
    try {
      const agent = {
        id: "agent-1", tenantId: "tenant-1", name: "Test Agent", owner: "human-1",
        walletAddress: null, publicKey: null, capabilities: [],
        createdAt: "2026-09-28T12:00:00Z", status: "active",
      };
      await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      const { status } = await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      expect(status).toBe(400);
    } finally { stop(); }
  });

  it("POST /policy/evaluate returns deny for blocked content", async () => {
    const { port, stop } = await startTestServer();
    try {
      const policy = {
        id: "policy-1", tenantId: "tenant-1", name: "Block Passwords", version: 1,
        rules: [{
          id: "rule-1", type: "content-filter", target: { kind: "global" },
          condition: { kind: "keyword", words: ["password"] },
          action: "deny", severity: "block",
        }],
        createdAt: "2026-09-28T12:00:00Z", approvedBy: "admin-1", status: "active",
      };
      const context = {
        tenantId: "tenant-1", timestamp: "2026-09-28T12:00:00Z",
        promptText: "What is your password?", outputText: null,
        modelVersionId: "v1", agentId: null,
        metadata: { tokensIn: 3, tokensOut: null, latencyMs: null, confidence: null },
        counters: { callsInWindow: 1, spendInWindow: 0 }, capabilities: [],
      };
      const { status, json } = await fetchJson(port, "/policy/evaluate", { method: "POST", body: { policy, context } });
      expect(status).toBe(200);
      expect(json.overall).toBe("deny");
    } finally { stop(); }
  });

  it("POST /prompts logs a prompt", async () => {
    const { port, stop } = await startTestServer();
    try {
      const prompt = {
        id: "p1", tenantId: "tenant-1", sessionId: "session-1", modelVersionId: "v1",
        policyVersion: 1, agentId: null, plaintextHash: "hash1", ciphertext: "encrypted",
        metadata: { tokensIn: 10, systemPromptHash: null, temperature: 0.7, topP: null, tags: [] },
        submittedAt: "2026-09-28T12:00:00Z",
      };
      const { status, json } = await fetchJson(port, "/prompts", { method: "POST", body: { prompt } });
      expect(status).toBe(201);
      expect(json.id).toBe("p1");
    } finally { stop(); }
  });

  it("POST /prompts/:id/outputs logs an output", async () => {
    const { port, stop } = await startTestServer();
    try {
      const prompt = {
        id: "p1", tenantId: "tenant-1", sessionId: "session-1", modelVersionId: "v1",
        policyVersion: 1, agentId: null, plaintextHash: "hash1", ciphertext: "encrypted",
        metadata: { tokensIn: 10, systemPromptHash: null, temperature: 0.7, topP: null, tags: [] },
        submittedAt: "2026-09-28T12:00:00Z",
      };
      await fetchJson(port, "/prompts", { method: "POST", body: { prompt } });

      const output = {
        id: "o1", tenantId: "tenant-1", promptId: "p1", modelVersionId: "v1",
        plaintextHash: "hash2", ciphertext: "encrypted-output",
        metadata: { tokensOut: 20, latencyMs: 150, finishReason: "stop", confidence: null },
        generatedAt: "2026-09-28T12:01:00Z",
      };
      const { status, json } = await fetchJson(port, "/prompts/p1/outputs", { method: "POST", body: { output } });
      expect(status).toBe(201);
      expect(json.id).toBe("o1");
    } finally { stop(); }
  });
});
