import { describe, it, expect } from "vitest";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { ScorerRegistry, registerDefaultScorers } from "../src/policy/scoring.js";
import { DecisionEngine } from "../src/policy/decision.js";
import { PreferencePolicy, Plan } from "../src/policy/types.js";

function makePolicy(overrides?: Partial<PreferencePolicy>): PreferencePolicy {
  return {
    version: "1.0",
    weights: { efficiency: 1 },
    constraints: [],
    contextRules: [],
    uncertaintyThreshold: 1,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
    ...overrides,
  };
}

function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: "p1",
    summary: "Test plan",
    steps: [{ kind: "action", detail: "do thing" }],
    meta: { reversibility: 1 },
    ...overrides,
  };
}

describe("decideAsync", () => {
  it("with sync constraints returns same result as decide", async () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy = makePolicy();
    const plans = [makePlan()];

    const syncResult = engine.decide(policy, "x", plans);
    const asyncResult = await engine.decideAsync(policy, "x", plans);

    expect(asyncResult.trace.outcome).toBe(syncResult.trace.outcome);
    expect(asyncResult.chosen?.id).toBe(syncResult.chosen?.id);
  });

  it("with async constraint handler awaits and includes result", async () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    c.register("async_check", {
      evaluate: (spec, plan) => ({ ok: true, id: spec.id }),
      evaluateAsync: async (spec, plan) => {
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true, id: spec.id };
      },
    });
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy = makePolicy({ constraints: ["async_check"] });
    const plans = [makePlan()];

    const result = await engine.decideAsync(policy, "x", plans);
    expect(result.trace.outcome).toBe("EXECUTE");
    expect(result.chosen?.id).toBe("p1");
  });

  it("async constraint that fails rejects plan", async () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    c.register("async_fail", {
      evaluate: (spec) => ({ ok: true, id: spec.id }),
      evaluateAsync: async (spec) => {
        await new Promise((r) => setTimeout(r, 10));
        return { ok: false, id: spec.id, reason: "Async check failed" };
      },
    });
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy = makePolicy({ version: "async-fail-test", constraints: ["async_fail"] });
    const plans = [makePlan({ id: "async-fail-plan" })];

    const result = await engine.decideAsync(policy, "async-fail-ctx", plans);
    expect(result.trace.outcome).toBe("NO_VALID_PLAN");
    expect(result.chosen).toBeUndefined();
  });

  it("evaluateAsync on ConstraintRegistry returns results", async () => {
    const c = new ConstraintRegistry();
    c.register("async_ok", {
      evaluate: (spec) => ({ ok: true, id: spec.id }),
      evaluateAsync: async (spec) => {
        return { ok: true, id: spec.id };
      },
    });

    const policy = makePolicy();
    const plan = makePlan();

    const results = await c.evaluateAsync(["async_ok"], plan, policy);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].id).toBe("async_ok");
  });
});
