import { describe, expect, it } from "vitest";
import { InMemoryEventStore } from "@mcptoolshop/attestia/event-store";
import { createCognateServer } from "../src/server.js";
import { eventVisibleToTenant, proveRecordedEvent } from "../src/event-proof.js";
import { createRegistry as createModelRegistry, type RequireEvaluationCitations } from "@cognate/model-registry";
import { citationRuleFromEnv } from "../src/routes/evaluations.js";
import { createRegistry as createIdentityRegistry, registerAgent } from "@cognate/agent-identity";
import { createStore as createPromptStore } from "@cognate/prompt-store";

// Rate-limit buckets are per agent and path prefix, and module-level; a fresh agent per server keeps tests apart.
let agentSeq = 0;
const TS = "2026-10-24T12:00:00Z";

function state(agent: string) {
  let identity = createIdentityRegistry();
  const r = registerAgent(identity, {
    id: agent,
    tenantId: "tenant-1",
    name: "Test Agent",
    owner: "human-1",
    walletAddress: null,
    publicKey: null,
    capabilities: [],
    createdAt: TS,
    status: "active",
  });
  if (r.ok) identity = r.state;
  return { registry: createModelRegistry(), identity, prompts: createPromptStore() };
}

type Appended = { streamId: string; events: ReadonlyArray<{ type?: string; metadata?: { eventId?: string }; payload?: Record<string, unknown> }> };

function recording(fail = false) {
  const appended: Appended[] = [];
  return {
    appended,
    eventStore: {
      append(streamId: string, events: Appended["events"]) {
        if (fail) throw new Error("store down");
        appended.push({ streamId, events });
        return { streamId, fromVersion: 1, toVersion: events.length, count: events.length };
      },
    },
  };
}

async function start(fail = false, requireEvaluationCitations?: RequireEvaluationCitations) {
  const agent = `eval-agent-${++agentSeq}`;
  const rec = recording(fail);
  const { server } = createCognateServer({
    state: state(agent),
    port: 0,
    host: "127.0.0.1",
    eventStore: rec.eventStore,
    ...(requireEvaluationCitations !== undefined ? { requireEvaluationCitations } : {}),
  });
  const port = await new Promise<number>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      resolve(typeof a === "object" && a !== null ? a.port : 0);
    }),
  );
  const post = async (path: string, body: unknown, auth = true) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { "X-Agent-Id": agent, "X-Timestamp": TS } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  return { rec, post, stop: () => server.close() };
}

const model = { id: "m1", tenantId: "tenant-1", name: "critic", description: "d", architecture: "t", createdAt: TS, owner: "human-1", currentVersion: null, status: "active" };
const version = { id: "v1", modelId: "m1", tenantId: "tenant-1", versionNumber: 1, weightsHash: "w", configHash: "c", manifestHash: "mf", datasetRefs: [], createdAt: TS, status: "registered" };
const evaluation = (id: string, overall = "pass") => ({
  id,
  tenantId: "tenant-1",
  modelVersionId: "v1",
  evaluator: "rnd",
  evaluatedAt: TS,
  metrics: [{ name: "false_refusals_sound", value: 4, threshold: 4.5, operator: "lte", passed: overall === "pass" }],
  overall,
  notes: "n",
});

async function withVersion() {
  const s = await start();
  await s.post("/registry/models", { model });
  await s.post("/registry/versions/v1", { version });
  return s;
}

describe("POST /registry/versions/:id/evaluations", () => {
  it("records an evaluation and appends it to the tenant's evaluations stream", async () => {
    const s = await withVersion();
    try {
      const r = await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e-19a") });
      expect(r.status).toBe(201);
      expect(r.json).toMatchObject({ evaluationId: "e-19a", versionId: "v1", eventId: expect.any(String) });
      const last = s.rec.appended.at(-1);
      expect(last?.streamId).toBe("cognate-tenant-1-evaluations");
      expect(last?.events[0]?.type).toBe("cognate.evaluation.recorded");
      expect(last?.events[0]?.metadata?.eventId).toBe(r.json.eventId);
    } finally {
      s.stop();
    }
  });

  it("attaches a run and its replication, then a decision that cites both", async () => {
    const s = await withVersion();
    try {
      expect((await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e-19a") })).status).toBe(201);
      expect((await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e-19r", "fail") })).status).toBe(201);
      const t = await s.post("/registry/versions/v1", {
        from: "registered",
        to: "evaluated",
        actorId: "rnd",
        reason: "both runs in",
        evaluationIds: ["e-19a", "e-19r"],
      });
      expect(t.status).toBe(200);
      expect(s.rec.appended.at(-1)?.events[0]?.payload).toMatchObject({ evaluationIds: ["e-19a", "e-19r"] });
      const bad = await s.post("/registry/versions/v1", { from: "evaluated", to: "rejected", actorId: "d", reason: "x", evaluationIds: ["nope"] });
      expect(bad.status).toBe(400);
      expect(bad.json.code).toBe("EVALUATION_NOT_FOUND");
    } finally {
      s.stop();
    }
  });

  it("refuses a transition whose evaluationIds is not an array of strings, and records nothing", async () => {
    const s = await withVersion();
    try {
      await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e-19a") });
      const before = s.rec.appended.length;
      for (const evaluationIds of ["e-19a", null, [1], { 0: "e-19a" }]) {
        const r = await s.post("/registry/versions/v1", { from: "registered", to: "evaluated", actorId: "rnd", reason: "x", evaluationIds });
        expect(r).toMatchObject({ status: 400, json: { code: "registry.invalid-evaluation-ids" } });
      }
      expect(s.rec.appended.length).toBe(before);
    } finally {
      s.stop();
    }
  });

  it("refuses a missing body, a version or tenant mismatch, and an unknown version", async () => {
    const s = await withVersion();
    try {
      expect((await s.post("/registry/versions/v1/evaluations", {})).json.code).toBe("registry.missing-evaluation");
      expect((await s.post("/registry/versions/v1/evaluations", { evaluation: { ...evaluation("e1"), modelVersionId: "v2" } })).json.code).toBe(
        "registry.evaluation-version-mismatch",
      );
      expect((await s.post("/registry/versions/v1/evaluations", { evaluation: { ...evaluation("e1"), tenantId: "tenant-2" } })).json.code).toBe(
        "registry.evaluation-tenant-mismatch",
      );
      const unknown = await s.post("/registry/versions/v9/evaluations", { evaluation: { ...evaluation("e1"), modelVersionId: "v9" } });
      expect(unknown).toMatchObject({ status: 404, json: { code: "VERSION_NOT_FOUND" } });
    } finally {
      s.stop();
    }
  });

  it("requires authentication", async () => {
    const s = await withVersion();
    try {
      expect((await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e1") }, false)).status).toBe(401);
    } finally {
      s.stop();
    }
  });

  it("returns 503 and keeps the registry unchanged when the append fails", async () => {
    const s = await start(true);
    try {
      const r = await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e1") });
      // The version doesn't exist on this server (its own creation needs no append), so the refusal comes first;
      // seed one through the registry route, which writes no event, and retry.
      expect(r.status).toBe(404);
      await s.post("/registry/models", { model });
      await s.post("/registry/versions/v1", { version });
      const failed = await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e1") });
      expect(failed).toMatchObject({ status: 503, json: { code: "attestia.append-failed" } });
      const again = await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e1") });
      expect(again.status).toBe(503); // not EVALUATION_ALREADY_RECORDED: the failed record was not kept
    } finally {
      s.stop();
    }
  });
});

describe("the requireEvaluationCitations setting", () => {
  async function evaluatedOn(rule?: RequireEvaluationCitations) {
    const s = await start(false, rule);
    await s.post("/registry/models", { model });
    await s.post("/registry/versions/v1", { version });
    await s.post("/registry/versions/v1/evaluations", { evaluation: evaluation("e1") });
    await s.post("/registry/versions/v1", { from: "registered", to: "evaluated", actorId: "rnd", reason: "e", evaluationIds: ["e1"] });
    return s;
  }

  it("defaults to false: an approval without citations goes through", async () => {
    const s = await evaluatedOn();
    try {
      expect((await s.post("/registry/versions/v1", { from: "evaluated", to: "approved", actorId: "d", reason: "ok" })).status).toBe(200);
    } finally {
      s.stop();
    }
  });

  it('"decisions" refuses an approval without citations and accepts one with them', async () => {
    const s = await evaluatedOn("decisions");
    try {
      const refused = await s.post("/registry/versions/v1", { from: "evaluated", to: "approved", actorId: "d", reason: "ok" });
      expect(refused).toMatchObject({ status: 400, json: { code: "EVALUATION_CITATION_REQUIRED" } });
      const ok = await s.post("/registry/versions/v1", { from: "evaluated", to: "approved", actorId: "d", reason: "ok", evaluationIds: ["e1"] });
      expect(ok.status).toBe(200);
    } finally {
      s.stop();
    }
  });

  it('"all" refuses an uncited transition of any kind', async () => {
    const s = await start(false, "all");
    try {
      await s.post("/registry/models", { model });
      await s.post("/registry/versions/v1", { version });
      const r = await s.post("/registry/versions/v1", { from: "registered", to: "evaluated", actorId: "rnd", reason: "e" });
      expect(r).toMatchObject({ status: 400, json: { code: "EVALUATION_CITATION_REQUIRED" } });
    } finally {
      s.stop();
    }
  });

  it("reads COGNATE_REQUIRE_EVALUATION_CITATIONS, and refuses a value it doesn't know", () => {
    expect(citationRuleFromEnv({})).toBe(false);
    expect(citationRuleFromEnv({ COGNATE_REQUIRE_EVALUATION_CITATIONS: "false" })).toBe(false);
    expect(citationRuleFromEnv({ COGNATE_REQUIRE_EVALUATION_CITATIONS: " decisions " })).toBe("decisions");
    expect(citationRuleFromEnv({ COGNATE_REQUIRE_EVALUATION_CITATIONS: "all" })).toBe("all");
    expect(() => citationRuleFromEnv({ COGNATE_REQUIRE_EVALUATION_CITATIONS: "sometimes" })).toThrow(/must be false, decisions or all/);
  });
});

describe("evaluation events are provable", () => {
  it("serves an inclusion proof for an event on the evaluations stream", async () => {
    expect(eventVisibleToTenant("cognate-tenant-1-evaluations", "tenant-1")).toBe(true);
    const store = new InMemoryEventStore();
    store.append("cognate-tenant-1-evaluations", [
      {
        type: "cognate.evaluation.recorded",
        metadata: { eventId: "ev-1", timestamp: TS, actor: "rnd", correlationId: "v1", source: "external" },
        payload: { id: "e-19a", modelVersionId: "v1", overall: "pass" },
      },
    ]);
    const proved = proveRecordedEvent(store.readAll(), "ev-1", "tenant-1");
    expect(proved.ok).toBe(true);
  });
});
