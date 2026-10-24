import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Evaluation, Model, ModelVersion } from "@cognate/types";
import { MerkleTree } from "@mcptoolshop/attestia/proof";
import {
  attestEvaluation,
  attestTransitionVersion,
  buildTransitionProof,
  createRegistry,
  getEvaluations,
  recordEvaluation,
  registerModel,
  registerVersion,
  transitionVersion,
} from "../src/index.js";
import { RegistryError } from "../src/types.js";
import type { RegistryState } from "../src/types.js";

const model = {
  id: "critic",
  tenantId: "t1",
  name: "critic",
  createdAt: "2026-10-24T00:00:00Z",
} as unknown as Model;

const version = (id: string, status: ModelVersion["status"] = "registered"): ModelVersion => ({
  id,
  modelId: "critic",
  tenantId: "t1",
  versionNumber: 1,
  weightsHash: "w",
  configHash: "c",
  manifestHash: "m",
  datasetRefs: [],
  createdAt: "2026-10-24T00:00:00Z",
  status,
});

const evaluation = (id: string, modelVersionId = "vB", overall: Evaluation["overall"] = "pass"): Evaluation => ({
  id,
  tenantId: "t1",
  modelVersionId,
  evaluator: "rnd",
  evaluatedAt: "2026-10-24T01:00:00Z",
  metrics: [{ name: "false_refusals_sound", value: 4, threshold: 4.5, operator: "lte", passed: true }],
  overall,
  notes: "seeds 0-2",
});

function base(...ids: string[]): RegistryState {
  let s = registerModel(createRegistry(), model);
  for (const id of ids.length ? ids : ["vB"]) s = registerVersion(s, version(id));
  return s;
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof RegistryError ? err.code : `not a RegistryError: ${String(err)}`;
  }
  return undefined;
}

describe("evaluations on a model version", () => {
  it("attaches a run and its replication to one version, in order", () => {
    let s = recordEvaluation(base(), evaluation("e-19a", "vB", "pass"));
    s = recordEvaluation(s, evaluation("e-19r", "vB", "fail"));
    expect(getEvaluations(s, "vB").map((e) => [e.id, e.overall])).toEqual([
      ["e-19a", "pass"],
      ["e-19r", "fail"],
    ]);
    // Recording is not a transition: the version stays where it was.
    expect(s.versions["vB"]?.status).toBe("registered");
  });

  it("does not mutate the state it was given", () => {
    const s0 = base();
    recordEvaluation(s0, evaluation("e1"));
    expect(getEvaluations(s0, "vB")).toEqual([]);
  });

  it("refuses an unknown version, a version mismatch, a tenant mismatch and a duplicate id", () => {
    const s = recordEvaluation(base("vB", "vA"), evaluation("e1"));
    expect(code(() => recordEvaluation(s, evaluation("e2", "nope")))).toBe("VERSION_NOT_FOUND");
    expect(code(() => recordEvaluation(s, { ...evaluation("e3"), tenantId: "t2" }))).toBe("EVALUATION_TENANT_MISMATCH");
    expect(code(() => recordEvaluation(s, evaluation("e1")))).toBe("EVALUATION_ALREADY_RECORDED");
    expect(code(() => recordEvaluation(s, evaluation("e1", "vA")))).toBe("EVALUATION_ALREADY_RECORDED");
  });

  it("refuses evaluations on a rejected or retired version", () => {
    let s = registerVersion(registerVersion(registerModel(createRegistry(), model), version("vR", "rejected")), version("vT", "retired"));
    expect(code(() => recordEvaluation(s, evaluation("e1", "vR")))).toBe("EVALUATION_ON_CLOSED_VERSION");
    expect(code(() => recordEvaluation(s, evaluation("e2", "vT")))).toBe("EVALUATION_ON_CLOSED_VERSION");
    s = registerVersion(s, version("vD", "deployed"));
    expect(getEvaluations(recordEvaluation(s, evaluation("e3", "vD")), "vD")).toHaveLength(1);
  });

  it("refuses an evaluation that names an account in plaintext, as a run record would be", () => {
    const s = base();
    expect(code(() => recordEvaluation(s, { ...evaluation("e1"), notes: "weights from acme/critic-weights" }))).toBe(
      "PLAINTEXT_ACCOUNT_IDENTIFIER",
    );
    expect(code(() => recordEvaluation(s, { ...evaluation("e2"), evaluator: ["ops", "example.com"].join("@") }))).toBe(
      "PLAINTEXT_ACCOUNT_IDENTIFIER",
    );
    expect(getEvaluations(recordEvaluation(s, evaluation("e3")), "vB")).toHaveLength(1);
  });

  it("reads an older snapshot without an evaluations map", () => {
    const { evaluations: _drop, ...old } = recordEvaluation(base(), evaluation("e1"));
    expect(getEvaluations(old as RegistryState, "vB")).toEqual([]);
    expect(getEvaluations(recordEvaluation(old as RegistryState, evaluation("e2")), "vB")).toHaveLength(1);
  });
});

describe("decisions that cite evaluations", () => {
  it("records the cited evaluation ids on the transition", () => {
    let s = recordEvaluation(base(), evaluation("e-19a"));
    s = transitionVersion(s, "vB", "registered", "evaluated", "rnd", "first evaluation", { evaluationIds: ["e-19a"] });
    s = recordEvaluation(s, evaluation("e-19r", "vB", "fail"));
    s = transitionVersion(s, "vB", "evaluated", "rejected", "director", "replication reverses the first run", {
      evaluationIds: ["e-19a", "e-19r"],
    });
    expect(s.versions["vB"]?.status).toBe("rejected");
    expect(s.transitions["vB"]?.map((t) => t.evaluationIds)).toEqual([["e-19a"], ["e-19a", "e-19r"]]);
  });

  it("refuses a citation that is unknown or belongs to another version", () => {
    let s = recordEvaluation(base("vB", "vA"), evaluation("eA", "vA"));
    expect(code(() => transitionVersion(s, "vB", "registered", "evaluated", "rnd", "x", { evaluationIds: ["nope"] }))).toBe(
      "EVALUATION_NOT_FOUND",
    );
    expect(code(() => transitionVersion(s, "vB", "registered", "evaluated", "rnd", "x", { evaluationIds: ["eA"] }))).toBe(
      "EVALUATION_NOT_FOUND",
    );
    s = recordEvaluation(s, evaluation("eB"));
    expect(code(() => transitionVersion(s, "vB", "registered", "evaluated", "rnd", "x", { evaluationIds: [] }))).toBe(
      "EVALUATION_IDS_EMPTY",
    );
  });

  it("lets an approved version be rejected before it is deployed", () => {
    let s = transitionVersion(base(), "vB", "registered", "evaluated", "rnd", "e");
    s = transitionVersion(s, "vB", "evaluated", "approved", "director", "tentative");
    s = transitionVersion(s, "vB", "approved", "rejected", "director", "replication failed");
    expect(s.versions["vB"]?.status).toBe("rejected");
  });

  it("still refuses rejecting a deployed or retired version", () => {
    let s = transitionVersion(base(), "vB", "registered", "evaluated", "rnd", "e");
    s = transitionVersion(s, "vB", "evaluated", "approved", "director", "ok");
    s = transitionVersion(s, "vB", "approved", "deployed", "director", "ship");
    expect(code(() => transitionVersion(s, "vB", "deployed", "rejected", "director", "late"))).toBe("INVALID_TRANSITION");
  });

  it("leaves a transition without citations exactly as before", () => {
    const s = transitionVersion(base(), "vB", "registered", "evaluated", "rnd", "e");
    expect(s.transitions["vB"]?.[0]).not.toHaveProperty("evaluationIds");
  });
});

describe("requireEvaluationCitations", () => {
  const toEvaluated = (s: RegistryState, rule?: unknown, ids?: string[]) =>
    transitionVersion(s, "vB", "registered", "evaluated", "rnd", "e", {
      ...(rule !== undefined ? { requireEvaluationCitations: rule as never } : {}),
      ...(ids ? { evaluationIds: ids } : {}),
    });
  const evaluated = () => toEvaluated(recordEvaluation(base(), evaluation("e1")), undefined, ["e1"]);

  it("false (the default) requires no citations anywhere", () => {
    let s = toEvaluated(base(), false);
    s = transitionVersion(s, "vB", "evaluated", "approved", "director", "ok", { requireEvaluationCitations: false });
    expect(s.versions["vB"]?.status).toBe("approved");
    expect(toEvaluated(base()).versions["vB"]?.status).toBe("evaluated");
  });

  it('"decisions" refuses approve and reject without citations, and allows other moves', () => {
    const s = evaluated();
    const opt = { requireEvaluationCitations: "decisions" as const };
    expect(code(() => transitionVersion(s, "vB", "evaluated", "approved", "director", "ok", opt))).toBe("EVALUATION_CITATION_REQUIRED");
    expect(code(() => transitionVersion(s, "vB", "evaluated", "rejected", "director", "no", opt))).toBe("EVALUATION_CITATION_REQUIRED");
    const approved = transitionVersion(s, "vB", "evaluated", "approved", "director", "ok", { ...opt, evaluationIds: ["e1"] });
    expect(approved.versions["vB"]?.status).toBe("approved");
    // Not a decision: deploy needs no citation under "decisions".
    expect(transitionVersion(approved, "vB", "approved", "deployed", "director", "ship", opt).versions["vB"]?.status).toBe("deployed");
    expect(toEvaluated(base(), "decisions").versions["vB"]?.status).toBe("evaluated");
  });

  it('"all" refuses every transition without citations', () => {
    expect(code(() => toEvaluated(base(), "all"))).toBe("EVALUATION_CITATION_REQUIRED");
    const s = toEvaluated(recordEvaluation(base(), evaluation("e1")), "all", ["e1"]);
    expect(s.versions["vB"]?.status).toBe("evaluated");
  });

  it("refuses an unknown rule", () => {
    expect(code(() => toEvaluated(base(), "sometimes"))).toBe("INVALID_CITATION_RULE");
  });
});

describe("attested evaluations", () => {
  function store() {
    const appended: Array<{ streamId: string; events: ReadonlyArray<{ type: string; payload: Record<string, unknown> }> }> = [];
    return {
      appended,
      eventStore: {
        append(streamId: string, events: ReadonlyArray<{ type: string; payload: Record<string, unknown> }>) {
          appended.push({ streamId, events });
          return { streamId, fromVersion: 1, toVersion: events.length, count: events.length };
        },
      },
    };
  }

  it("appends one cognate.evaluation.recorded on the tenant's evaluations stream", async () => {
    const st = store();
    const s = await attestEvaluation(base(), { eventStore: st.eventStore as never, tenantId: "t1" }, evaluation("e-19a"));
    expect(getEvaluations(s, "vB")).toHaveLength(1);
    expect(st.appended).toHaveLength(1);
    expect(st.appended[0]?.streamId).toBe("cognate-t1-evaluations");
    expect(st.appended[0]?.events[0]?.type).toBe("cognate.evaluation.recorded");
    expect(st.appended[0]?.events[0]?.payload).toMatchObject({ id: "e-19a", modelVersionId: "vB", overall: "pass" });
  });

  it("returns no new state when the append fails", async () => {
    const failing = { append: () => Promise.reject(new Error("disk full")) };
    await expect(attestEvaluation(base(), { eventStore: failing as never, tenantId: "t1" }, evaluation("e1"))).rejects.toMatchObject({
      code: "attestia.append-failed",
    });
  });

  it("puts cited evaluation ids in the transition event, and nothing new when there are none", async () => {
    const st = store();
    let s = recordEvaluation(base(), evaluation("e1"));
    s = await attestTransitionVersion(s, { eventStore: st.eventStore as never, tenantId: "t1" }, "vB", "registered", "evaluated", "rnd", "e", {
      evaluationIds: ["e1"],
    });
    await attestTransitionVersion(s, { eventStore: st.eventStore as never, tenantId: "t1" }, "vB", "evaluated", "approved", "director", "ok");
    expect(st.appended[0]?.events[0]?.payload).toMatchObject({ evaluationIds: ["e1"] });
    expect(st.appended[1]?.events[0]?.payload).not.toHaveProperty("evaluationIds");
  });

  it("keeps the lineage hash of a transition without citations byte-identical", () => {
    const s = transitionVersion(base(), "vB", "registered", "evaluated", "rnd", "e");
    const t = s.transitions["vB"]![0]!;
    const legacy = createHash("sha256")
      .update(JSON.stringify({ modelVersionId: t.modelVersionId, from: t.from, to: t.to, actorId: t.actorId, reason: t.reason, timestamp: t.timestamp }))
      .digest("hex");
    // The root is exactly what the pre-evaluations code computed from the same six fields.
    expect(buildTransitionProof(s, "vB")).toEqual({ root: MerkleTree.build([legacy]).getRoot(), count: 1 });
    // A cited transition binds its citations, so its leaf (and root) differ.
    const cited = transitionVersion(recordEvaluation(base(), evaluation("e1")), "vB", "registered", "evaluated", "rnd", "e", { evaluationIds: ["e1"] });
    expect(buildTransitionProof(cited, "vB")?.root).not.toBe(MerkleTree.build([legacy]).getRoot());
  });
});
