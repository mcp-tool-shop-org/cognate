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

function setup() {
  const c = new ConstraintRegistry();
  registerDefaultConstraints(c);
  const s = new ScorerRegistry();
  registerDefaultScorers(s);
  return new DecisionEngine(c, s);
}

describe("DecisionEngine", () => {
  it("filters out plans that violate constraints", () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    c.register("confirm_spend_money", {
      evaluate: (spec, plan) => {
        if ((plan.meta.tags ?? []).includes("spend_money")) {
          return { ok: false, id: spec.id, reason: "Requires confirmation to spend money" };
        }
        return { ok: true, id: spec.id };
      }
    });
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy: any = {
      version: "1.0",
      weights: { efficiency: 1 },
      constraints: ["confirm_spend_money"],
      contextRules: [],
      uncertaintyThreshold: 1,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const plans: any[] = [
      { id: "buy", summary: "Buy", steps: [], meta: { tags: ["spend_money"], reversibility: 1 } },
      { id: "ask", summary: "Ask", steps: [], meta: { tags: [], reversibility: 1 } }
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("EXECUTE");
    expect(chosen?.id).toBe("ask");
    const buyEval = trace.candidates.find(c => c.plan.id === "buy")!.eval;
    expect(buyEval.passesConstraints).toBe(false);
    expect(buyEval.violatedConstraints.map(c => typeof c === "string" ? c : c.id)).toContain("confirm_spend_money");
  });

  it("asks user when uncertainty exceeds threshold", () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy: any = {
      version: "1.0",
      weights: { efficiency: 1 },
      constraints: [],
      contextRules: [],
      uncertaintyThreshold: 0.2,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const plans: any[] = [
      { id: "p1", summary: "Do it", steps: [], meta: { uncertainty: 0.9, reversibility: 1 } }
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("ASK_USER");
    expect(chosen).toBeUndefined();
  });

  it("fails closed on unknown constraint", () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    const engine = new DecisionEngine(c, s);

    const policy: any = {
      version: "1.0",
      weights: { efficiency: 1 },
      constraints: ["does_not_exist"],
      contextRules: [],
      uncertaintyThreshold: 1,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const plans: any[] = [
      { id: "p1", summary: "Do it", steps: [], meta: { reversibility: 1 } }
    ];

    const { trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("NO_VALID_PLAN");
    expect(trace.candidates[0].eval.violatedConstraints.map(c => typeof c === "string" ? c : c.id)).toContain("does_not_exist");
  });

  it("chooses the higher-utility plan when multiple pass constraints", () => {
    const engine = setup();
    const policy = makePolicy({ weights: { efficiency: 1 } });

    // Plan with shorter time → higher efficiency score
    const plans: Plan[] = [
      { id: "slow", summary: "Slow", steps: [], meta: { estimatedTimeSec: 600, reversibility: 1 } },
      { id: "fast", summary: "Fast", steps: [], meta: { estimatedTimeSec: 1, reversibility: 1 } },
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("EXECUTE");
    expect(chosen?.id).toBe("fast");
    const fastEval = trace.candidates.find(c => c.plan.id === "fast")!.eval;
    const slowEval = trace.candidates.find(c => c.plan.id === "slow")!.eval;
    expect(fastEval.utility).toBeGreaterThan(slowEval.utility);
  });

  it("still chooses a plan when weight key has no registered scorer (scores 0)", () => {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    // Do NOT register any scorers — weight keys will score 0
    const engine = new DecisionEngine(c, s);

    const policy = makePolicy({ weights: { missing_key: 1 } });
    const plans: Plan[] = [
      { id: "p1", summary: "Do it", steps: [], meta: { reversibility: 1 } },
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    // Plan still passes constraints and is chosen (utility = 0 but it's the only survivor)
    expect(trace.outcome).toBe("EXECUTE");
    expect(chosen?.id).toBe("p1");
    // The utility is 0 because no scorer is registered for missing_key
    const eval0 = trace.candidates[0].eval;
    expect(eval0.utility).toBe(0);
    expect(eval0.passesConstraints).toBe(true);
  });

  it("returns NO_VALID_PLAN (not ASK_USER) when high uncertainty + all plans fail constraints", () => {
    const engine = setup();
    const policy = makePolicy({
      constraints: ["no_irreversible_changes"],
      uncertaintyThreshold: 0.1,
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Irreversible", steps: [], meta: { uncertainty: 0.9, reversibility: 0 } },
      { id: "p2", summary: "Also irreversible", steps: [], meta: { uncertainty: 0.8, reversibility: 0 } },
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("NO_VALID_PLAN");
    expect(chosen).toBeUndefined();
  });

  it("returns NO_VALID_PLAN with rationale when plans array is empty", () => {
    const engine = setup();
    const policy = makePolicy();

    const { chosen, trace } = engine.decide(policy, "x", []);

    expect(trace.outcome).toBe("NO_VALID_PLAN");
    expect(chosen).toBeUndefined();
    expect(trace.rationale.some(r => r.includes("No candidate plans"))).toBe(true);
    expect(trace.candidates).toHaveLength(0);
  });

  it("context rule that adds a constraint causes a passing plan to fail", () => {
    const engine = setup();
    const policy = makePolicy({
      constraints: [],
      contextRules: [
        {
          context: "strict",
          adjust: {
            constraintsAdd: ["no_irreversible_changes"],
          },
        },
      ],
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Irreversible", steps: [], meta: { reversibility: 0 } },
    ];

    // Without context rule, no constraints → would pass
    const { trace: normalTrace } = engine.decide(policy, "casual", plans);
    expect(normalTrace.outcome).toBe("EXECUTE");

    // With matching context, constraint is added → fails
    const { trace: strictTrace } = engine.decide(policy, "strict", plans);
    expect(strictTrace.outcome).toBe("NO_VALID_PLAN");
  });

  it("context rule that removes a constraint causes a failing plan to pass", () => {
    const engine = setup();
    const policy = makePolicy({
      constraints: ["no_irreversible_changes"],
      contextRules: [
        {
          context: "relaxed",
          adjust: {
            constraintsRemove: ["no_irreversible_changes"],
          },
        },
      ],
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Irreversible", steps: [], meta: { reversibility: 0 } },
    ];

    // Without context rule match → fails
    const { trace: normalTrace } = engine.decide(policy, "default", plans);
    expect(normalTrace.outcome).toBe("NO_VALID_PLAN");

    // With matching context, constraint is removed → passes
    const { trace: relaxedTrace } = engine.decide(policy, "relaxed", plans);
    expect(relaxedTrace.outcome).toBe("EXECUTE");
  });

  it("trace.appliedContextRules contains provenance when a context rule matches", () => {
    const engine = setup();
    const policy = makePolicy({
      weights: { efficiency: 0.5, safety: 0.5 },
      contextRules: [
        {
          context: "production",
          adjust: {
            weights: { safety: 0.9 },
            constraintsAdd: ["no_irreversible_changes"],
          },
        },
      ],
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Safe op", steps: [], meta: { reversibility: 1 } },
    ];

    const { trace } = engine.decide(policy, "production", plans);

    expect(trace.appliedContextRules).toHaveLength(1);
    expect(trace.appliedContextRules[0].context).toBe("production");
    expect(trace.appliedContextRules[0].adjustments.length).toBeGreaterThanOrEqual(1);
    // Should contain human-readable descriptions of what was adjusted
    expect(trace.appliedContextRules[0].adjustments.some(a => a.includes("weight"))).toBe(true);
    expect(trace.appliedContextRules[0].adjustments.some(a => a.includes("constraint"))).toBe(true);
  });

  it("trace.appliedContextRules is empty when no context rules match", () => {
    const engine = setup();
    const policy = makePolicy({
      contextRules: [
        {
          context: "production",
          adjust: { weights: { safety: 0.9 } },
        },
      ],
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Op", steps: [], meta: { reversibility: 1 } },
    ];

    const { trace } = engine.decide(policy, "development", plans);

    expect(trace.appliedContextRules).toEqual([]);
  });

  it("warns about last-writer-wins when two context rules adjust the same field", () => {
    const engine = setup();
    const policy = makePolicy({
      contextRules: [
        {
          context: "overlap",
          adjust: { weights: { efficiency: 0.2 } },
        },
        {
          context: "overlap",
          adjust: { weights: { efficiency: 0.8 } },
        },
      ],
    });

    const plans: Plan[] = [
      { id: "p1", summary: "Op", steps: [], meta: { reversibility: 1 } },
    ];

    const { trace } = engine.decide(policy, "overlap", plans);

    // The rationale should contain a last-writer-wins warning
    expect(trace.rationale.some(r => r.includes("Last-writer-wins"))).toBe(true);
    expect(trace.rationale.some(r => r.includes("weights"))).toBe(true);
  });

  it("EXECUTE when top-utility plan has low uncertainty, even if low-utility plan has high uncertainty", () => {
    const engine = setup();
    const policy = makePolicy({
      weights: { efficiency: 1 },
      uncertaintyThreshold: 0.3,
    });

    const plans: Plan[] = [
      // High utility (fast), low uncertainty → should be chosen
      { id: "confident-fast", summary: "Fast & sure", steps: [], meta: { estimatedTimeSec: 1, uncertainty: 0.1, reversibility: 1 } },
      // Low utility (slow), high uncertainty → should NOT trigger ASK_USER
      { id: "uncertain-slow", summary: "Slow & unsure", steps: [], meta: { estimatedTimeSec: 600, uncertainty: 0.9, reversibility: 1 } },
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("EXECUTE");
    expect(chosen?.id).toBe("confident-fast");
  });

  it("ASK_USER when top-utility plan has high uncertainty, naming that plan", () => {
    const engine = setup();
    const policy = makePolicy({
      weights: { efficiency: 1 },
      uncertaintyThreshold: 0.3,
    });

    const plans: Plan[] = [
      // High utility (fast) but high uncertainty
      { id: "risky-fast", summary: "Fast but risky", steps: [], meta: { estimatedTimeSec: 1, uncertainty: 0.8, reversibility: 1 } },
      // Low utility (slow), low uncertainty
      { id: "safe-slow", summary: "Slow but safe", steps: [], meta: { estimatedTimeSec: 600, uncertainty: 0.1, reversibility: 1 } },
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("ASK_USER");
    expect(chosen).toBeUndefined();
    // Rationale should name the specific plan
    expect(trace.rationale.some(r => r.includes("risky-fast"))).toBe(true);
  });

  it("NO_VALID_PLAN rationale contains 'Top violations:' with constraint names and counts", () => {
    const engine = setup();
    const policy = makePolicy({
      constraints: ["no_irreversible_changes", "max_cost"],
    });

    const plans: Plan[] = [
      // Fails no_irreversible_changes
      { id: "p1", summary: "Irreversible", steps: [], meta: { reversibility: 0, estimatedCost: 0 } },
      // Fails no_irreversible_changes AND max_cost (unknown → fail-closed)
      { id: "p2", summary: "Also bad", steps: [], meta: { reversibility: 0, estimatedCost: 999 } },
    ];

    const { trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("NO_VALID_PLAN");
    expect(trace.rationale.some(r => r.includes("Top violations:"))).toBe(true);
    // Should mention constraint ids
    expect(trace.rationale.some(r => r.includes("no_irreversible_changes"))).toBe(true);
  });

  it("trace.decisionId matches UUID format (8-4-4-4-12 hex)", () => {
    const engine = setup();
    const policy = makePolicy();

    const plans: Plan[] = [
      { id: "p1", summary: "Op", steps: [], meta: { reversibility: 1 } },
    ];

    const { trace } = engine.decide(policy, "x", plans);

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(trace.decisionId).toMatch(uuidPattern);
  });
});
