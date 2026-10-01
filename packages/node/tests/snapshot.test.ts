import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRegistry, registerModel, registerVersion } from "@cognate/model-registry";
import { createStore, logOutput, logPrompt } from "@cognate/prompt-store";
import { loadSnapshots, saveSnapshots } from "../src/snapshot.js";
import { resolveRuntimePaths } from "../src/runtime.js";
import type { Agent, CapabilityGrant, Model, ModelVersion, Output, Prompt } from "@cognate/types";

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
} as Model;

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
  repo: "acme/weights",
  release: "1.2.3",
} as ModelVersion;

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
} as Agent;

const grant = {
  id: "grant-1",
  tenantId: "tenant-1",
  agentId: "agent-1",
  capability: {
    id: "cap-1",
    kind: "inference",
    scope: { kind: "unlimited" },
    constraints: [],
    grantedAt: "2026-09-28T12:00:00Z",
    grantedBy: "human-1",
    expiresAt: null,
  },
  requestedBy: "human-1",
  requestedAt: "2026-09-28T12:00:00Z",
  status: "pending",
  approvedBy: null,
  approvedAt: null,
} as CapabilityGrant;

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
} as Prompt;

const output = {
  id: "o1",
  tenantId: "tenant-1",
  promptId: "p1",
  modelVersionId: "v1",
  plaintextHash: "hash2",
  ciphertext: "encrypted-output",
  metadata: { tokensOut: 20, latencyMs: 150, finishReason: "stop", confidence: null },
  generatedAt: "2026-09-28T12:01:00Z",
} as Output;

describe("snapshots", () => {
  let dir = "";

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function paths() {
    dir = mkdtempSync(join(tmpdir(), "cognate-snap-"));
    return {
      registry: join(dir, "registry.json"),
      agents: join(dir, "agents.json"),
      prompts: join(dir, "prompts.json"),
    };
  }

  it("reloads the registry, the grants, and the prompts", () => {
    const files = paths();
    let registry = createRegistry();
    registry = registerModel(registry, model);
    registry = registerVersion(registry, version);
    const logged = logPrompt(createStore(), prompt);
    if (!logged.ok) throw new Error(logged.error.message);
    const withOutput = logOutput(logged.state, output);
    if (!withOutput.ok) throw new Error(withOutput.error.message);
    saveSnapshots(files, {
      registry,
      identity: { agents: new Map([[agent.id, agent]]), grants: new Map([[grant.id, grant]]) },
      prompts: withOutput.state,
    });
    const loaded = loadSnapshots(files);
    expect(loaded.registry.models["m1"]?.name).toBe("Test Model");
    expect(loaded.registry.versions["v1"]?.status).toBe("registered");
    expect(loaded.registry.versions["v1"]?.repo).toBe("acme/weights");
    expect(loaded.registry.versions["v1"]?.release).toBe("1.2.3");
    expect(loaded.identity.agents.get("agent-1")?.name).toBe("Test Agent");
    expect(loaded.identity.grants.get("grant-1")?.status).toBe("pending");
    expect(loaded.prompts.prompts.get("p1")?.plaintextHash).toBe("hash1");
    expect(loaded.prompts.outputs.get("o1")?.plaintextHash).toBe("hash2");
  });

  it("starts empty when the files are missing", () => {
    const loaded = loadSnapshots(paths());
    expect(Object.keys(loaded.registry.models)).toEqual([]);
    expect(loaded.identity.agents.size).toBe(0);
    expect(loaded.prompts.prompts.size).toBe(0);
  });

  it("fails closed when a snapshot is not JSON", () => {
    const files = paths();
    writeFileSync(files.registry, "{", "utf8");
    expect(() => loadSnapshots(files)).toThrow();
  });
});

describe("runtime paths", () => {
  it("uses the compose file paths when they are set", () => {
    const paths = resolveRuntimePaths({
      ATTESTIA_EVENTS_FILE: "/app/data/events.jsonl",
      COGNATE_DATA_DIR: "/app/data",
      COGNATE_MODEL_REGISTRY_PATH: "/app/data/cognate/registry.json",
      COGNATE_AGENT_REGISTRY_PATH: "/app/data/cognate/agents.json",
      COGNATE_PROMPT_STORE_PATH: "/app/data/cognate/prompts.json",
    }, "/work");
    expect(paths).toEqual({
      eventsFile: "/app/data/events.jsonl",
      registry: "/app/data/cognate/registry.json",
      agents: "/app/data/cognate/agents.json",
      prompts: "/app/data/cognate/prompts.json",
    });
  });

  it("defaults the log and the three snapshots under data/", () => {
    const paths = resolveRuntimePaths({}, join("work"));
    expect(paths.eventsFile).toBe(join("work", "data", "events.jsonl"));
    expect(paths.registry).toBe(join("work", "data", "cognate", "registry.json"));
    expect(paths.agents).toBe(join("work", "data", "cognate", "agents.json"));
    expect(paths.prompts).toBe(join("work", "data", "cognate", "prompts.json"));
  });
});
