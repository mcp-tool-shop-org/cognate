import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { canonicalize } from "json-canonicalize";
import { InMemoryEventStore } from "@mcptoolshop/attestia/event-store";
import { createRegistry, preRegisterRun, getRunPreRegistration } from "@cognate/model-registry";
import type { ActorId, HashId, TenantId, Timestamp } from "@cognate/types";
import { createKernel } from "../src/policy/kernel.js";
import { DecisionEngine } from "../src/policy/decision.js";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { ScorerRegistry, registerDefaultScorers } from "../src/policy/scoring.js";
import { AttestationError, attestDecision, computeDecisionDigests } from "../src/attestation.js";
import { DecisionTrace, Plan, PreferencePolicy } from "../src/policy/types.js";

const HEX64 = /^[0-9a-f]{64}$/;
const ID = { decisionId: "dec-0001", timestamp: "2026-10-28T00:00:00.000Z" };

const policy: PreferencePolicy = {
  version: "1.0",
  weights: { efficiency: 1 },
  constraints: ["no_irreversible_changes"],
  contextRules: [{ context: "deploy:*", adjust: { uncertaintyThreshold: 0.9 } }],
  uncertaintyThreshold: 0.5,
  memory: {},
  calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
};

const plans: Plan[] = [
  {
    id: "drop-and-recreate",
    summary: "Drop the table",
    steps: [{ kind: "sql", detail: "DROP TABLE runs" }],
    meta: { reversibility: 0, estimatedTimeSec: 5 },
  },
  {
    id: "migrate-in-place",
    summary: "Migrate with a backup",
    steps: [{ kind: "sql", detail: "ALTER TABLE runs ADD COLUMN card TEXT" }],
    meta: { reversibility: 1, estimatedTimeSec: 60 },
  },
];

function decide(ps: Plan[] = plans) {
  const c = new ConstraintRegistry();
  registerDefaultConstraints(c);
  const s = new ScorerRegistry();
  registerDefaultScorers(s);
  return new DecisionEngine(c, s).decide(policy, "deploy:db", ps, ID);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("computeDecisionDigests", () => {
  it("hashes the canonical trace, effective policy and chosen plan", () => {
    const { chosen, trace } = decide();
    const d = computeDecisionDigests(trace, chosen);
    expect(d.decisionSha256).toBe(sha256(canonicalize(trace)));
    expect(d.policySha256).toBe(sha256(canonicalize(trace.effectivePolicy)));
    expect(d.planSha256).toBe(sha256(canonicalize(chosen)));
    for (const v of Object.values(d)) expect(v).toMatch(HEX64);
  });

  it("is stable for the same inputs, and covers the plan's steps", () => {
    const a = decide();
    const b = decide();
    expect(computeDecisionDigests(a.trace, a.chosen)).toEqual(computeDecisionDigests(b.trace, b.chosen));

    const edited = structuredClone(plans);
    edited[1].steps[0].detail = "ALTER TABLE runs DROP COLUMN card";
    const c = decide(edited);
    // Steps aren't in the trace, so only the plan digest moves.
    expect(computeDecisionDigests(c.trace, c.chosen).decisionSha256).toBe(computeDecisionDigests(a.trace).decisionSha256);
    expect(computeDecisionDigests(c.trace, c.chosen).planSha256).not.toBe(computeDecisionDigests(a.trace, a.chosen).planSha256);
  });

  it("gives planSha256 null without a plan", () => {
    const { trace } = decide();
    expect(computeDecisionDigests(trace).planSha256).toBeNull();
  });

  it("refuses a plan the decision didn't choose", () => {
    const { trace } = decide();
    expect(() => computeDecisionDigests(trace, plans[0])).toThrow(AttestationError);
    expect(() => computeDecisionDigests(trace, plans[0])).toThrow(/chose "migrate-in-place"/);

    const asked = { ...trace, chosenPlanId: undefined, outcome: "ASK_USER" as const };
    try {
      computeDecisionDigests(asked, plans[1]);
      expect.unreachable();
    } catch (err) {
      expect((err as AttestationError).code).toBe("civility.plan-mismatch");
      expect((err as AttestationError).message).toMatch(/chose no plan \(outcome ASK_USER\)/);
    }
  });

  it("refuses a non-finite number instead of hashing it as null", () => {
    const { trace } = decide();
    const bad: DecisionTrace = structuredClone(trace);
    bad.candidates[0].eval.utility = -Infinity;
    try {
      computeDecisionDigests(bad);
      expect.unreachable();
    } catch (err) {
      expect((err as AttestationError).code).toBe("civility.non-finite-number");
      expect((err as AttestationError).message).toMatch(/trace\.candidates\.0\.eval\.utility/);
    }
  });

  it("feeds a run pre-registration that the model registry accepts", () => {
    const { chosen, trace } = decide();
    const d = computeDecisionDigests(trace, chosen);
    const state = preRegisterRun(createRegistry(), {
      id: "prereg-civility-1" as HashId,
      tenantId: "tenant-1" as TenantId,
      planSha256: d.planSha256 as HashId,
      decisionSha256: d.decisionSha256,
      caps: { maxUnits: 1, maxWallSeconds: 600, margin: 0.5 },
      plannedCard: "CPU",
      approvedBy: "publisher" as ActorId,
      registeredAt: ID.timestamp as Timestamp,
    });
    expect(getRunPreRegistration(state, "prereg-civility-1")?.decisionSha256).toBe(d.decisionSha256);
  });
});

describe("attestDecision", () => {
  it("appends cognate.policy.decided to the tenant's policy stream", async () => {
    const store = new InMemoryEventStore();
    const { chosen, trace } = decide();
    const res = await attestDecision({ eventStore: store, tenantId: "tenant-1", actorId: "agent-7" }, trace, chosen);

    expect(res.streamId).toBe("cognate-tenant-1-policy");
    expect(res.digests).toEqual(computeDecisionDigests(trace, chosen));
    const [stored] = store.readAll();
    expect(stored.streamId).toBe("cognate-tenant-1-policy");
    expect(stored.event.type).toBe("cognate.policy.decided");
    expect(stored.event.metadata).toMatchObject({
      eventId: res.eventId,
      timestamp: ID.timestamp,
      actor: "agent-7",
      correlationId: ID.decisionId,
    });
    expect(stored.event.payload).toEqual({
      decisionId: ID.decisionId,
      tenantId: "tenant-1",
      context: "deploy:db",
      outcome: "EXECUTE",
      chosenPlanId: "migrate-in-place",
      decisionSha256: res.digests.decisionSha256,
      policySha256: res.digests.policySha256,
      planSha256: res.digests.planSha256,
      appliedContextRules: ["deploy:*"],
      violatedConstraints: [{ planId: "drop-and-recreate", constraintIds: ["no_irreversible_changes"] }],
    });
  });

  it("keeps plan steps and constraint reasons out of the event", async () => {
    const store = new InMemoryEventStore();
    const { chosen, trace } = decide();
    await attestDecision({ eventStore: store, tenantId: "tenant-1", actorId: "agent-7" }, trace, chosen);
    const text = JSON.stringify(store.readAll()[0].event);
    expect(text).not.toContain("DROP TABLE");
    expect(text).not.toContain("ALTER TABLE");
    expect(text).not.toContain("irreversible action");
  });

  it("records a decision that chose nothing, under a custom stream prefix", async () => {
    const store = new InMemoryEventStore();
    const kernel = createKernel({ policy: { ...policy, uncertaintyThreshold: 0 } });
    const trace = kernel.decide("ops", [{ ...plans[1], meta: { ...plans[1].meta, uncertainty: 0.4 } }], ID);
    const res = await attestDecision({ eventStore: store, tenantId: "t2", actorId: "a", streamPrefix: "lab" }, trace);
    expect(res.streamId).toBe("lab-t2-policy");
    expect(store.readAll()[0].event.payload).toMatchObject({ outcome: "ASK_USER", chosenPlanId: null, planSha256: null });
  });

  it("fails closed when the append fails", async () => {
    const { chosen, trace } = decide();
    for (const thrown of [new Error("disk full"), "lock held"]) {
      const eventStore = {
        append: () => {
          throw thrown;
        },
      };
      try {
        await attestDecision({ eventStore, tenantId: "tenant-1", actorId: "agent-7" }, trace, chosen);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(AttestationError);
        expect((err as AttestationError).code).toBe("attestia.append-failed");
        expect((err as AttestationError).message).toContain(thrown instanceof Error ? thrown.message : thrown);
      }
    }
  });
});
