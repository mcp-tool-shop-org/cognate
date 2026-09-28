import { describe, expect, it } from "vitest";
import { createCognateServer } from "../src/server.js";
import { handleRegistry } from "../src/routes/registry.js";
import { handlePrompts } from "../src/routes/prompts.js";
import { createRegistry as createModelRegistry } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";

function emptyState() {
  return {
    registry: createModelRegistry(),
    identity: createIdentityRegistry(),
    prompts: createPromptStore(),
  };
}

async function startTestServer() {
  const { server } = createCognateServer({
    state: emptyState(),
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

const model = {
  id: "m1",
  tenantId: "tenant-1",
  name: "Test Model",
  description: "A test model",
  architecture: "transformer",
  createdAt: "2026-09-28T12:00:00Z",
  owner: "human-1",
  currentVersion: null,
  status: "active",
};

const version = {
  id: "v1",
  modelId: "m1",
  tenantId: "tenant-1",
  versionNumber: 1,
  weightsHash: "w1",
  configHash: "c1",
  manifestHash: "mf1",
  datasetRefs: [],
  createdAt: "2026-09-28T12:00:00Z",
  status: "registered",
};

const agent = {
  id: "agent-1",
  tenantId: "tenant-1",
  name: "Test Agent",
  owner: "human-1",
  walletAddress: null,
  publicKey: null,
  capabilities: [],
  createdAt: "2026-09-28T12:00:00Z",
  status: "active",
};

const prompt = {
  id: "p1",
  tenantId: "tenant-1",
  sessionId: "session-1",
  modelVersionId: "v1",
  policyVersion: 1,
  agentId: null,
  plaintextHash: "hash1",
  ciphertext: "encrypted",
  metadata: { tokensIn: 10, systemPromptHash: null, temperature: 0.7, topP: null, tags: [] },
  submittedAt: "2026-09-28T12:00:00Z",
};

const output = {
  id: "o1",
  tenantId: "tenant-1",
  promptId: "p1",
  modelVersionId: "v1",
  plaintextHash: "hash2",
  ciphertext: "encrypted-output",
  metadata: { tokensOut: 20, latencyMs: 150, finishReason: "stop", confidence: null },
  generatedAt: "2026-09-28T12:01:00Z",
};

describe("Cognate HTTP API", () => {
  it("returns health status", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/health");
      expect(status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.service).toBe("cognate");
      expect(json.mode).toBe("api");
    } finally {
      stop();
    }
  });

  it("returns 404 for unknown routes", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/unknown");
      expect(status).toBe(404);
      expect(json.error).toBe("Not found");
    } finally {
      stop();
    }
  });

  it("POST /registry/models registers a model", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      expect(status).toBe(200);
      expect(json.id).toBe("m1");
    } finally {
      stop();
    }
  });

  it("POST /registry/models fails when the model body is missing", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/registry/models", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.code).toBe("registry.missing-model");
    } finally {
      stop();
    }
  });

  it("POST /registry/models fails for a duplicate", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      const { status, json } = await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      expect(status).toBe(400);
      expect(json.code).toBe("MODEL_ALREADY_EXISTS");
    } finally {
      stop();
    }
  });

  it("POST /registry/versions/:id registers a version", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      const { status, json } = await fetchJson(port, "/registry/versions/v1", { method: "POST", body: { version } });
      expect(status).toBe(200);
      expect(json.id).toBe("v1");
    } finally {
      stop();
    }
  });

  it("POST /registry/versions/:id fails when the version already exists", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      await fetchJson(port, "/registry/versions/v1", { method: "POST", body: { version } });
      const { status, json } = await fetchJson(port, "/registry/versions/v1", { method: "POST", body: { version } });
      expect(status).toBe(400);
      expect(json.code).toBe("VERSION_ALREADY_EXISTS");
    } finally {
      stop();
    }
  });

  it("POST /registry/versions/:id transitions a version", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/registry/models", { method: "POST", body: { model } });
      await fetchJson(port, "/registry/versions/v1", { method: "POST", body: { version } });
      const { status, json } = await fetchJson(port, "/registry/versions/v1", {
        method: "POST",
        body: { from: "registered", to: "evaluated", actorId: "admin-1", reason: "Initial evaluation" },
      });
      expect(status).toBe(200);
      expect(json.versionId).toBe("v1");
      expect(json.to).toBe("evaluated");
    } finally {
      stop();
    }
  });

  it("POST /registry/versions/:id fails for an invalid transition", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/registry/versions/v1", {
        method: "POST",
        body: { from: "registered", to: "deployed", actorId: "admin-1", reason: "Skip" },
      });
      expect(status).toBe(400);
      expect(json.code).toBe("VERSION_NOT_FOUND");
    } finally {
      stop();
    }
  });

  it("POST /registry/versions/:id fails for an invalid request body", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/registry/versions/v1", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.code).toBe("registry.invalid-request");
    } finally {
      stop();
    }
  });

  it("POST /identity/agents registers an agent", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      expect(status).toBe(201);
      expect(json.id).toBe("agent-1");
    } finally {
      stop();
    }
  });

  it("POST /identity/agents fails when the agent body is missing", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/identity/agents", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.code).toBe("identity.missing-agent");
    } finally {
      stop();
    }
  });

  it("POST /identity/agents fails for a duplicate", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      const { status } = await fetchJson(port, "/identity/agents", { method: "POST", body: { agent } });
      expect(status).toBe(400);
    } finally {
      stop();
    }
  });

  it("POST /identity/grants/:id/approve fails when the grant is not found", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/identity/grants/grant-1/approve", {
        method: "POST",
        body: { approverId: "admin-1", timestamp: "2026-09-28T12:01:00Z" },
      });
      expect(status).toBe(400);
      expect(json.code).toBe("identity.grant-not-found");
    } finally {
      stop();
    }
  });

  it("POST /identity/grants/:id/approve fails when params are missing", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/identity/grants/grant-1/approve", {
        method: "POST",
        body: {},
      });
      expect(status).toBe(400);
      expect(json.code).toBe("identity.missing-params");
    } finally {
      stop();
    }
  });

  it("POST /identity/grants/:id without approve is not a grant route", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/identity/grants/grant-1", {
        method: "POST",
        body: { approverId: "admin-1", timestamp: "2026-09-28T12:01:00Z" },
      });
      expect(status).toBe(400);
      expect(json.code).toBe("identity.not-found");
    } finally {
      stop();
    }
  });

  it("POST /policy/evaluate returns deny for blocked content", async () => {
    const { port, stop } = await startTestServer();
    try {
      const policy = {
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
        createdAt: "2026-09-28T12:00:00Z",
        approvedBy: "admin-1",
        status: "active",
      };
      const context = {
        tenantId: "tenant-1",
        actorId: "actor-1",
        modelVersionId: "v1",
        agentId: null,
        timestamp: "2026-09-28T12:00:00Z",
        promptText: "What is your password?",
        outputText: null,
        metadata: {
          tokensIn: 3,
          tokensOut: null,
          latencyMs: null,
          confidence: null,
          finishReason: null,
          tags: [],
        },
        agentCapabilities: [],
        counters: { callsInWindow: 1, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
      };
      const { status, json } = await fetchJson(port, "/policy/evaluate", { method: "POST", body: { policy, context } });
      expect(status).toBe(200);
      expect(json.overall).toBe("deny");
    } finally {
      stop();
    }
  });

  it("POST /policy/evaluate fails when policy or context is missing", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/policy/evaluate", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.error).toBe("Missing policy or context");
    } finally {
      stop();
    }
  });

  it("POST /prompts logs a prompt", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/prompts", { method: "POST", body: { prompt } });
      expect(status).toBe(201);
      expect(json.id).toBe("p1");
    } finally {
      stop();
    }
  });

  it("POST /prompts fails when the body has no prompt", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/prompts", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.code).toBe("prompts.missing-prompt");
    } finally {
      stop();
    }
  });

  it("POST /prompts/:id/outputs logs an output", async () => {
    const { port, stop } = await startTestServer();
    try {
      await fetchJson(port, "/prompts", { method: "POST", body: { prompt } });
      const { status, json } = await fetchJson(port, "/prompts/p1/outputs", { method: "POST", body: { output } });
      expect(status).toBe(201);
      expect(json.id).toBe("o1");
    } finally {
      stop();
    }
  });

  it("POST /prompts/:id/outputs fails when the prompt is not found", async () => {
    const { port, stop } = await startTestServer();
    try {
      const missing = { ...output, promptId: "missing" };
      const { status, json } = await fetchJson(port, "/prompts/missing/outputs", { method: "POST", body: { output: missing } });
      expect(status).toBe(400);
      expect(json.code).toBe("store.prompt-not-found");
    } finally {
      stop();
    }
  });

  it("POST /prompts/:id/outputs fails when the body has no output", async () => {
    const { port, stop } = await startTestServer();
    try {
      const { status, json } = await fetchJson(port, "/prompts/p1/outputs", { method: "POST", body: {} });
      expect(status).toBe(400);
      expect(json.code).toBe("prompts.missing-output");
    } finally {
      stop();
    }
  });

  it("returns 500 when the JSON body is invalid", async () => {
    const { port, stop } = await startTestServer();
    try {
      const url = `http://127.0.0.1:${port}/registry/models`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const json = await res.json() as { error: string; message: string };
      expect(res.status).toBe(500);
      expect(json.error).toBe("Internal server error");
      expect(json.message).toBe("Invalid JSON");
    } finally {
      stop();
    }
  });
});

describe("route handlers for paths the server does not dispatch", () => {
  it("registry returns not-found for a path outside its two routes", () => {
    const result = handleRegistry(emptyState(), "/registry/other", "POST", {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("registry.not-found");
  });

  it("prompts returns not-found for a path outside log and output", () => {
    const result = handlePrompts(emptyState(), "/prompts/p1", "POST", {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("prompts.not-found");
  });
});
