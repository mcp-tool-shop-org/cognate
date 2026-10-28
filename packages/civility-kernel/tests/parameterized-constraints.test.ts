import { describe, it, expect } from "vitest";
import {
  ConstraintRegistry,
  ScorerRegistry,
  DecisionEngine,
  registerDefaultConstraints,
  registerDefaultScorers,
  type PreferencePolicy,
  type Plan
} from "../src/index.js";

describe("parameterized constraints", () => {
  function setup() {
    const c = new ConstraintRegistry();
    registerDefaultConstraints(c);
    const s = new ScorerRegistry();
    registerDefaultScorers(s);
    return new DecisionEngine(c, s);
  }

  it("blocks spend above max_spend_without_confirm and includes params in trace", () => {
    const engine = setup();

    const policy: PreferencePolicy = {
      version: "1.1.0",
      weights: { efficiency: 1 },
      constraints: [{ id: "max_spend_without_confirm", params: { amount: 20, currency: "USD" } }],
      contextRules: [],
      uncertaintyThreshold: 1,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const plans: Plan[] = [
      {
        id: "buy-50",
        summary: "Buy for $50",
        steps: [{ kind: "purchase", detail: "Checkout" }],
        meta: { tags: ["spend_money"], estimatedCost: 50, reversibility: 1 }
      },
      { id: "ask", summary: "Ask", steps: [], meta: { reversibility: 1 } }
    ];

    const { chosen, trace } = engine.decide(policy, "x", plans);

    expect(trace.outcome).toBe("EXECUTE");
    expect(chosen?.id).toBe("ask");

    const buy = trace.candidates.find(c => c.plan.id === "buy-50")!;
    expect(buy.eval.passesConstraints).toBe(false);

    // Assert trace includes params on the violation
    expect(
      buy.eval.violatedConstraints.some(
        v => typeof v === "object" && v.id === "max_spend_without_confirm" && v.params && v.params.amount === 20
      )
    ).toBe(true);
  });

  it("context rules can remove a parameterized constraint by id", () => {
    const engine = setup();

    const policy: PreferencePolicy = {
      version: "1.1.0",
      weights: { efficiency: 1 },
      constraints: [{ id: "max_spend_without_confirm", params: { amount: 20 } }],
      contextRules: [
        {
          context: "work",
          adjust: { constraintsRemove: ["max_spend_without_confirm"] }
        }
      ],
      uncertaintyThreshold: 1,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const plans: Plan[] = [
      {
        id: "buy-50",
        summary: "Buy for $50",
        steps: [{ kind: "purchase", detail: "Checkout" }],
        meta: { tags: ["spend_money"], estimatedCost: 50, reversibility: 1 }
      }
    ];

    const { trace } = engine.decide(policy, "work", plans);
    // With constraint removed, it should not be NO_VALID_PLAN due to max spend
    expect(trace.outcome).not.toBe("NO_VALID_PLAN");
  });

  describe("require_confirm_if constraint", () => {
    it("passes when stake is below stakeGte", () => {
      const engine = setup();
      const policy: PreferencePolicy = {
        version: "1.0",
        weights: { efficiency: 1 },
        constraints: [{ id: "require_confirm_if", params: { stakeGte: 0.7 } }],
        contextRules: [],
        uncertaintyThreshold: 1,
        memory: {},
        calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      };

      const plans: Plan[] = [
        { id: "low-stake", summary: "Low stake", steps: [], meta: { stake: 0.3, reversibility: 1 } },
      ];

      const { trace } = engine.decide(policy, "x", plans);
      expect(trace.outcome).toBe("EXECUTE");
      expect(trace.candidates[0].eval.passesConstraints).toBe(true);
    });

    it("fails when stake >= stakeGte and irreversible is false (default)", () => {
      const engine = setup();
      const policy: PreferencePolicy = {
        version: "1.0",
        weights: { efficiency: 1 },
        constraints: [{ id: "require_confirm_if", params: { stakeGte: 0.5 } }],
        contextRules: [],
        uncertaintyThreshold: 1,
        memory: {},
        calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      };

      const plans: Plan[] = [
        { id: "high-stake", summary: "High stake", steps: [], meta: { stake: 0.8, reversibility: 1 } },
      ];

      const { trace } = engine.decide(policy, "x", plans);
      expect(trace.outcome).toBe("NO_VALID_PLAN");
      expect(trace.candidates[0].eval.passesConstraints).toBe(false);
    });

    it("passes when irreversible: true but plan IS reversible", () => {
      const engine = setup();
      const policy: PreferencePolicy = {
        version: "1.0",
        weights: { efficiency: 1 },
        constraints: [{ id: "require_confirm_if", params: { stakeGte: 0.5, irreversible: true } }],
        contextRules: [],
        uncertaintyThreshold: 1,
        memory: {},
        calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      };

      const plans: Plan[] = [
        { id: "high-but-reversible", summary: "Reversible", steps: [], meta: { stake: 0.9, reversibility: 1 } },
      ];

      const { trace } = engine.decide(policy, "x", plans);
      expect(trace.outcome).toBe("EXECUTE");
      expect(trace.candidates[0].eval.passesConstraints).toBe(true);
    });

    it("fails when irreversible: true and plan IS irreversible", () => {
      const engine = setup();
      const policy: PreferencePolicy = {
        version: "1.0",
        weights: { efficiency: 1 },
        constraints: [{ id: "require_confirm_if", params: { stakeGte: 0.5, irreversible: true } }],
        contextRules: [],
        uncertaintyThreshold: 1,
        memory: {},
        calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      };

      const plans: Plan[] = [
        { id: "high-and-irreversible", summary: "Irreversible", steps: [], meta: { stake: 0.9, reversibility: 0 } },
      ];

      const { trace } = engine.decide(policy, "x", plans);
      expect(trace.outcome).toBe("NO_VALID_PLAN");
      expect(trace.candidates[0].eval.passesConstraints).toBe(false);
    });
  });
});
