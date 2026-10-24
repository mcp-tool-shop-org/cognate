import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCognateServer, type ServerState } from "../src/server.js";
import { createRegistry as createModelRegistry, recordEvaluation, registerModel, registerVersion } from "@cognate/model-registry";
import { createRegistry as createIdentityRegistry, registerAgent, requestGrant } from "@cognate/agent-identity";
import { createStore as createPromptStore, logPrompt } from "@cognate/prompt-store";
import { generateEd25519KeyPair, type Ed25519KeyPairMaterial } from "../src/middleware/signature.js";
import { signHttpRequest } from "../src/client.js";
import type { Agent, CapabilityGrant, Evaluation, Model, ModelVersion, ModelVersionStatus, Prompt } from "@cognate/types";

// Every route takes its tenant from the authenticated caller. Tenant 2's agent calls with tenant 1's ids; each refusal
// must append nothing, change nothing, and (where an id is named) look exactly like a miss.

const TS = "2026-10-24T12:00:00Z";
const REPO_HASH = `sha256:${createHash("sha256").update("acme/weights").digest("hex")}`;
let seq = 0; // rate-limit buckets are module-level and per agent; a fresh pair of agents per server keeps tests apart
const agentKeys = new Map<string, Ed25519KeyPairMaterial>();

function keyFor(id: string): Ed25519KeyPairMaterial {
  let kp = agentKeys.get(id);
  if (!kp) {
    kp = generateEd25519KeyPair();
    agentKeys.set(id, kp);
  }
  return kp;
}

const delegateCap = (id: string) => ({
  id: `cap-del-${id}`,
  kind: "delegate" as const,
  scope: { kind: "unlimited" as const },
  constraints: [],
  grantedAt: TS,
  grantedBy: "root",
  expiresAt: null,
});

const agent = (id: string, tenantId: string, withDelegate = false): Agent => {
  const kp = keyFor(id);
  return {
    id,
    tenantId,
    name: id,
    owner: "human-1",
    principal: "human",
    walletAddress: null,
    publicKey: kp.publicKey,
    kid: kp.kid,
    capabilities: withDelegate ? [delegateCap(id)] : [],
    createdAt: TS,
    status: "active",
  } as unknown as Agent;
};
const model = (id: string, tenantId: string): Model =>
  ({ id, tenantId, name: id, description: "d", architecture: "t", createdAt: TS, owner: "human-1", currentVersion: null, status: "active" }) as Model;
const version = (id: string, tenantId: string, status: ModelVersionStatus = "registered", modelId = "m1"): ModelVersion =>
  ({
    id,
    modelId,
    tenantId,
    versionNumber: 1,
    weightsHash: "w",
    configHash: "c",
    manifestHash: "mf",
    datasetRefs: [],
    createdAt: TS,
    status,
    repo: REPO_HASH,
    release: "1.2.3",
  }) as ModelVersion;
const evaluation = (id: string, modelVersionId: string, tenantId: string): Evaluation =>
  ({
    id,
    tenantId,
    modelVersionId,
    evaluator: "rnd",
    evaluatedAt: TS,
    metrics: [{ name: "m", value: 1, threshold: 2, operator: "lte", passed: true }],
    overall: "pass",
    notes: "n",
  }) as Evaluation;
const grant = (id: string, tenantId: string, agentId: string): CapabilityGrant =>
  ({
    id,
    tenantId,
    agentId,
    capability: { id: `cap-${id}`, kind: "inference", scope: { kind: "unlimited" }, constraints: [], grantedAt: TS, grantedBy: "human-1", expiresAt: null },
    requestedBy: "human-1",
    requestedAt: TS,
    status: "pending",
    approvedBy: null,
    approvedAt: null,
  }) as CapabilityGrant;
const prompt = (id: string, tenantId: string): Prompt =>
  ({
    id,
    tenantId,
    sessionId: "s",
    modelVersionId: "v-registered",
    policyVersion: 1,
    agentId: null,
    plaintextHash: "h",
    ciphertext: "c",
    metadata: { tokensIn: 1, systemPromptHash: null, temperature: 0, topP: null, tags: [] },
    submittedAt: TS,
  }) as Prompt;

const STATUSES: ModelVersionStatus[] = ["registered", "evaluated", "approved", "deployed"];
const TRANSITIONS: Array<[ModelVersionStatus, ModelVersionStatus]> = [
  ["registered", "evaluated"],
  ["evaluated", "approved"],
  ["evaluated", "rejected"],
  ["approved", "deployed"],
  ["approved", "rejected"],
  ["deployed", "retired"],
];

function seeded(a: string, b: string): ServerState {
  let identity = createIdentityRegistry();
  const aTarget = `${a}-target`;
  for (const ag of [agent(a, "tenant-1", true), agent(aTarget, "tenant-1"), agent(b, "tenant-2", true)]) {
    const r = registerAgent(identity, ag);
    if (!r.ok) throw new Error(r.error.message);
    identity = r.state;
  }
  const g = requestGrant(identity, grant("g1", "tenant-1", aTarget));
  if (!g.ok) throw new Error(g.error.message);
  identity = g.state;
  let registry = registerModel(registerModel(createModelRegistry(), model("m1", "tenant-1")), model("m2", "tenant-2"));
  for (const s of STATUSES) registry = registerVersion(registry, version(`v-${s}`, "tenant-1", s));
  registry = recordEvaluation(registry, evaluation("e1", "v-evaluated", "tenant-1"));
  const p = logPrompt(createPromptStore(), prompt("p1", "tenant-1"));
  if (!p.ok) throw new Error(p.error.message);
  return { registry, identity, prompts: p.state };
}

function bindCaller(body: unknown, callerId: string): unknown {
  if (!body || typeof body !== "object") return body;
  const obj = { ...(body as Record<string, unknown>) };
  if (obj.actorId === "admin-1") obj.actorId = callerId;
  if (obj.approverId === "admin-1") obj.approverId = callerId;
  if (obj.model && typeof obj.model === "object") {
    const m = { ...(obj.model as Record<string, unknown>) };
    if (m.owner === "human-1") m.owner = callerId;
    obj.model = m;
  }
  if (obj.evaluation && typeof obj.evaluation === "object") {
    const ev = { ...(obj.evaluation as Record<string, unknown>) };
    if (ev.evaluator === "rnd") ev.evaluator = callerId;
    obj.evaluation = ev;
  }
  if (obj.agent && typeof obj.agent === "object") {
    const ag = { ...(obj.agent as Record<string, unknown>) };
    if (ag.owner === "human-1") ag.owner = callerId;
    obj.agent = ag;
  }
  if (obj.grant && typeof obj.grant === "object") {
    const gr = { ...(obj.grant as Record<string, unknown>) };
    if (gr.requestedBy === "human-1") gr.requestedBy = callerId;
    if (gr.capability && typeof gr.capability === "object") {
      const cap = { ...(gr.capability as Record<string, unknown>) };
      if (cap.grantedBy === "human-1") cap.grantedBy = callerId;
      gr.capability = cap;
    }
    obj.grant = gr;
  }
  if (obj.context && typeof obj.context === "object") {
    const ctx = { ...(obj.context as Record<string, unknown>) };
    if (ctx.actorId === "admin-1") ctx.actorId = callerId;
    obj.context = ctx;
  }
  return obj;
}

async function start() {
  const a = `t1-agent-${++seq}`;
  const b = `t2-agent-${seq}`;
  const appended: string[] = [];
  const releaseCalls: string[] = [];
  const { server, state } = createCognateServer({
    state: seeded(a, b),
    port: 0,
    host: "127.0.0.1",
    eventStore: {
      append(streamId: string, events: readonly unknown[]) {
        appended.push(streamId);
        return { streamId, fromVersion: 1, toVersion: events.length, count: events.length };
      },
    },
    verifyRelease: async (repo: string) => {
      releaseCalls.push(repo);
      return { status: "PASS" };
    },
  });
  const port = await new Promise<number>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr !== null ? addr.port : 0);
    }),
  );
  const post = async (as: string, path: string, body: unknown) => {
    const kp = keyFor(as);
    const payload = bindCaller(body, as);
    const signed = signHttpRequest({
      method: "POST",
      path,
      agentId: as,
      seedHex: kp.seedHex,
      kid: kp.kid,
      body: payload,
    });
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: signed.headers,
      body: signed.rawBody,
    });
    return { status: res.status, text: await res.text() };
  };
  const snapshot = () => JSON.stringify({ r: state.registry, g: [...state.identity.grants.values()], a: [...state.identity.agents.keys()], p: [...state.prompts.prompts.keys()], o: [...state.prompts.outputs.keys()] });
  return { a, b, post, appended, releaseCalls, snapshot, stop: () => server.close() };
}

const move = (from: ModelVersionStatus, to: ModelVersionStatus) => ({ from, to, actorId: "admin-1", reason: "r", repo: REPO_HASH, release: "1.2.3" });

describe("version transitions are scoped to the caller's tenant", () => {
  for (const [from, to] of TRANSITIONS) {
    it(`${from} → ${to}: another tenant gets the missing-id 404 and nothing is recorded; the owner moves it`, async () => {
      const s = await start();
      try {
        const before = s.snapshot();
        const cross = await s.post(s.b, `/registry/versions/v-${from}`, move(from, to));
        const missing = await s.post(s.b, "/registry/versions/v-nope", move(from, to));
        expect(cross.status).toBe(404);
        expect(cross.text.replace(`v-${from}`, "ID")).toBe(missing.text.replace("v-nope", "ID"));
        expect(missing.status).toBe(404);
        expect(s.appended).toEqual([]);
        expect(s.releaseCalls).toEqual([]);
        expect(s.snapshot()).toBe(before);
        const own = await s.post(s.a, `/registry/versions/v-${from}`, move(from, to));
        expect(own.status).toBe(200);
        expect(JSON.parse(own.text)).toMatchObject({ versionId: `v-${from}`, to });
      } finally {
        s.stop();
      }
    });
  }
});

describe("evaluations are scoped to the caller's tenant", () => {
  it("another tenant's version looks missing, and the owner records", async () => {
    const s = await start();
    try {
      const before = s.snapshot();
      const cross = await s.post(s.b, "/registry/versions/v-registered/evaluations", { evaluation: evaluation("e9", "v-registered", "tenant-2") });
      const missing = await s.post(s.b, "/registry/versions/v-nope/evaluations", { evaluation: evaluation("e9", "v-nope", "tenant-2") });
      expect(cross.status).toBe(404);
      expect(cross.text.replace("v-registered", "ID")).toBe(missing.text.replace("v-nope", "ID"));
      expect(s.appended).toEqual([]);
      expect(s.snapshot()).toBe(before);
      const own = await s.post(s.a, "/registry/versions/v-registered/evaluations", { evaluation: evaluation("e9", "v-registered", "tenant-1") });
      expect(own.status).toBe(201);
    } finally {
      s.stop();
    }
  });
});

describe("registration is scoped to the caller's tenant", () => {
  it("refuses a model for another tenant, and registers one for the caller's", async () => {
    const s = await start();
    try {
      const before = s.snapshot();
      const cross = await s.post(s.b, "/registry/models", { model: model("m9", "tenant-1") });
      expect(cross.status).toBe(400);
      expect(JSON.parse(cross.text).code).toBe("registry.tenant-mismatch");
      expect(s.snapshot()).toBe(before);
      expect((await s.post(s.b, "/registry/models", { model: model("m9", "tenant-2") })).status).toBe(200);
    } finally {
      s.stop();
    }
  });

  it("refuses a version for another tenant, under another tenant's model, or under a different path id", async () => {
    const s = await start();
    try {
      const before = s.snapshot();
      const wrongTenant = await s.post(s.b, "/registry/versions/v9", { version: version("v9", "tenant-1", "registered", "m2") });
      expect(wrongTenant.status).toBe(400);
      expect(JSON.parse(wrongTenant.text).code).toBe("registry.tenant-mismatch");
      // Tenant 2 naming tenant 1's model gets exactly what a missing model gets.
      const otherModel = await s.post(s.b, "/registry/versions/v9", { version: version("v9", "tenant-2", "registered", "m1") });
      const noModel = await s.post(s.b, "/registry/versions/v9", { version: version("v9", "tenant-2", "registered", "m-nope") });
      expect(otherModel.status).toBe(noModel.status);
      expect(otherModel.text.replace("m1", "ID")).toBe(noModel.text.replace("m-nope", "ID"));
      const pathMismatch = await s.post(s.b, "/registry/versions/v8", { version: version("v9", "tenant-2", "registered", "m2") });
      expect(pathMismatch.status).toBe(400);
      expect(JSON.parse(pathMismatch.text).code).toBe("registry.version-id-mismatch");
      expect(s.snapshot()).toBe(before);
      expect((await s.post(s.b, "/registry/versions/v9", { version: version("v9", "tenant-2", "registered", "m2") })).status).toBe(200);
    } finally {
      s.stop();
    }
  });
});

describe("prompts, outputs and policy are scoped to the caller's tenant", () => {
  it("refuses a prompt for another tenant and logs one for the caller's", async () => {
    const s = await start();
    try {
      const cross = await s.post(s.b, "/prompts", { prompt: prompt("p9", "tenant-1") });
      expect(cross.status).toBe(400);
      expect(JSON.parse(cross.text).code).toBe("prompts.tenant-mismatch");
      expect(s.appended).toEqual([]);
      expect((await s.post(s.b, "/prompts", { prompt: prompt("p9", "tenant-2") })).status).toBe(201);
      expect(s.appended).toEqual(["cognate-tenant-2-prompts"]);
    } finally {
      s.stop();
    }
  });

  it("refuses an output for another tenant, or on another tenant's prompt as if it were missing", async () => {
    const s = await start();
    try {
      const output = (id: string, promptId: string, tenantId: string) => ({
        output: {
          id,
          tenantId,
          promptId,
          modelVersionId: "v-registered",
          plaintextHash: "h",
          ciphertext: "c",
          metadata: { tokensOut: 1, latencyMs: 1, finishReason: "stop", confidence: null },
          generatedAt: TS,
        },
      });
      const before = s.snapshot();
      const wrongTenant = await s.post(s.b, "/prompts/p1/outputs", output("o9", "p1", "tenant-1"));
      expect(wrongTenant.status).toBe(400);
      expect(JSON.parse(wrongTenant.text).code).toBe("prompts.tenant-mismatch");
      const otherPrompt = await s.post(s.b, "/prompts/p1/outputs", output("o9", "p1", "tenant-2"));
      const noPrompt = await s.post(s.b, "/prompts/p-nope/outputs", output("o9", "p-nope", "tenant-2"));
      expect(otherPrompt.status).toBe(404);
      expect(otherPrompt.text.replace("p1", "ID")).toBe(noPrompt.text.replace("p-nope", "ID"));
      const pathMismatch = await s.post(s.a, "/prompts/p-other/outputs", output("o9", "p1", "tenant-1"));
      expect(pathMismatch.status).toBe(400);
      expect(JSON.parse(pathMismatch.text).code).toBe("prompts.prompt-id-mismatch");
      expect(s.appended).toEqual([]);
      expect(s.snapshot()).toBe(before);
      expect((await s.post(s.a, "/prompts/p1/outputs", output("o9", "p1", "tenant-1"))).status).toBe(201);
    } finally {
      s.stop();
    }
  });

  it("refuses a policy evaluation for another tenant and records one for the caller's", async () => {
    const s = await start();
    try {
      const body = (tenantId: string, policyTenant = tenantId) => ({
        policy: { id: "pol-1", tenantId: policyTenant, name: "p", version: 1, rules: [], createdAt: TS, updatedAt: TS, status: "active" },
        context: { tenantId, actorId: "admin-1", timestamp: TS },
      });
      for (const b of [body("tenant-1"), body("tenant-2", "tenant-1")]) {
        const cross = await s.post(s.b, "/policy/evaluate", b);
        expect(cross.status).toBe(400);
        expect(JSON.parse(cross.text).code).toBe("policy.tenant-mismatch");
      }
      expect(s.appended).toEqual([]);
      expect((await s.post(s.b, "/policy/evaluate", body("tenant-2"))).status).toBe(200);
      expect(s.appended).toEqual(["cognate-tenant-2-policy"]);
    } finally {
      s.stop();
    }
  });
});

describe("identity is scoped to the caller's tenant", () => {
  it("registers agents only into the caller's tenant", async () => {
    const s = await start();
    try {
      const cross = await s.post(s.b, "/identity/agents", { agent: agent("intruder", "tenant-1") });
      expect(cross.status).toBe(400);
      expect(JSON.parse(cross.text).code).toBe("identity.tenant-mismatch");
      // The refused agent can't authenticate afterwards.
      expect((await s.post("intruder", "/registry/models", { model: model("m8", "tenant-1") })).status).toBe(401);
      expect((await s.post(s.b, "/identity/agents", { agent: agent(`t2-second-${seq}`, "tenant-2") })).status).toBe(201);
    } finally {
      s.stop();
    }
  });

  it("refuses a grant for another tenant, or for another tenant's agent as if it were missing", async () => {
    const s = await start();
    try {
      const before = s.snapshot();
      const wrongTenant = await s.post(s.b, "/identity/grants", { grant: grant("g9", "tenant-1", s.a) });
      expect(wrongTenant.status).toBe(400);
      expect(JSON.parse(wrongTenant.text).code).toBe("identity.tenant-mismatch");
      const otherAgent = await s.post(s.b, "/identity/grants", { grant: grant("g9", "tenant-2", s.a) });
      const noAgent = await s.post(s.b, "/identity/grants", { grant: grant("g9", "tenant-2", "nobody") });
      expect(otherAgent.status).toBe(404);
      expect(otherAgent.text.replace(s.a, "ID")).toBe(noAgent.text.replace("nobody", "ID"));
      expect(s.snapshot()).toBe(before);
      expect((await s.post(s.b, "/identity/grants", { grant: grant("g9", "tenant-2", s.b) })).status).toBe(200);
    } finally {
      s.stop();
    }
  });

  it("another tenant's grant looks missing to approve and to export, and the owner approves and exports it", async () => {
    const s = await start();
    try {
      const before = s.snapshot();
      const approve = { approverId: "admin-1", timestamp: TS };
      const crossApprove = await s.post(s.b, "/identity/grants/g1/approve", approve);
      const missingApprove = await s.post(s.b, "/identity/grants/g-nope/approve", approve);
      expect(crossApprove.status).toBe(404);
      expect(crossApprove.text.replace("g1", "ID")).toBe(missingApprove.text.replace("g-nope", "ID"));
      const crossVc = await s.post(s.b, "/identity/grants/g1/vc", { issuerId: "urn:x" });
      const missingVc = await s.post(s.b, "/identity/grants/g-nope/vc", { issuerId: "urn:x" });
      expect(crossVc.status).toBe(404);
      expect(crossVc.text.replace("g1", "ID")).toBe(missingVc.text.replace("g-nope", "ID"));
      expect(s.snapshot()).toBe(before);
      expect((await s.post(s.a, "/identity/grants/g1/approve", approve)).status).toBe(200);
      expect((await s.post(s.a, "/identity/grants/g1/vc", { issuerId: "urn:x" })).status).toBe(200);
    } finally {
      s.stop();
    }
  });
});
