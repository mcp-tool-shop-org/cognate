import { describe, it, expect } from "vitest";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { ScorerRegistry, registerDefaultScorers } from "../src/policy/scoring.js";
import { DecisionEngine } from "../src/policy/decision.js";
import { PreferencePolicy, Plan, DecisionTrace } from "../src/policy/types.js";

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

describe("onDecision hook", () => {
  it("fires after decide()", () => {
    const traces: DecisionTrace[] = [];
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s, {
      onDecision: (trace) => { traces.push(trace); },
    });

    const policy = makePolicy();
    const plans = [makePlan()];

    engine.decide(policy, "x", plans);

    expect(traces).toHaveLength(1);
  });

  it("receives the decision trace", () => {
    let receivedTrace: DecisionTrace | undefined;
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s, {
      onDecision: (trace) => { receivedTrace = trace; },
    });

    const policy = makePolicy();
    const plans = [makePlan({ id: "hook-test" })];

    const { trace } = engine.decide(policy, "hook-context", plans);

    expect(receivedTrace).toBeDefined();
    expect(receivedTrace!.decisionId).toBe(trace.decisionId);
    expect(receivedTrace!.context).toBe("hook-context");
    expect(receivedTrace!.candidates).toHaveLength(1);
  });

  it("async callback is awaited in decideAsync()", async () => {
    let resolved = false;
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s, {
      onDecision: async (trace) => {
        await new Promise((r) => setTimeout(r, 10));
        resolved = true;
      },
    });

    const policy = makePolicy();
    const plans = [makePlan()];

    await engine.decideAsync(policy, "x", plans);

    expect(resolved).toBe(true);
  });
});
