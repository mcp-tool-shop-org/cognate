import { describe, it, expect } from "vitest";
import { canonicalizePolicy } from "../src/policy/canonicalize.js";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { PreferencePolicy } from "../src/policy/types.js";

describe("canonicalizePolicy", () => {
  it("fills defaults and sorts constraints", () => {
    const registry = new ConstraintRegistry();
    registerDefaultConstraints(registry);

    const policy: PreferencePolicy = {
      version: "1.0",
      weights: { low_risk: 0.5, efficiency: 1 },
      constraints: [
        { id: "require_confirm_if", params: { stakeGte: 0.5 } }, // missing irreversible default
        "no_irreversible_changes"
      ],
      contextRules: [],
      uncertaintyThreshold: 0.5,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const canonical = canonicalizePolicy(policy, registry);

    // Weights sorted
    expect(Object.keys(canonical.weights)).toEqual(["efficiency", "low_risk"]);

    // Constraints sorted and defaults filled
    expect(canonical.constraints[0]).toBe("no_irreversible_changes");
    expect(canonical.constraints[1]).toEqual({
      id: "require_confirm_if",
      params: { stakeGte: 0.5, irreversible: false } // default filled
    });
  });

  it("canonicalizes a policy with no constraints", () => {
    const registry = new ConstraintRegistry();
    registerDefaultConstraints(registry);

    const policy: PreferencePolicy = {
      version: "1.0",
      weights: { low_risk: 0.5, efficiency: 1 },
      constraints: [],
      contextRules: [],
      uncertaintyThreshold: 0.5,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const canonical = canonicalizePolicy(policy, registry);
    expect(canonical.constraints).toEqual([]);
    expect(Object.keys(canonical.weights)).toEqual(["efficiency", "low_risk"]);
  });

  it("falls back to raw spec when constraint params are invalid", () => {
    const registry = new ConstraintRegistry();
    registerDefaultConstraints(registry);

    const policy: PreferencePolicy = {
      version: "1.0",
      weights: { efficiency: 1 },
      constraints: [{ id: "max_spend_without_confirm", params: { amount: "not_a_number" } }],
      contextRules: [],
      uncertaintyThreshold: 0.5,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const canonical = canonicalizePolicy(policy, registry);
    // Should fall back to the raw spec with original params
    expect(canonical.constraints[0]).toEqual({
      id: "max_spend_without_confirm",
      params: { amount: "not_a_number" }
    });
  });

  it("sorts constraintsAdd specs inside context rules", () => {
    const registry = new ConstraintRegistry();
    registerDefaultConstraints(registry);

    const policy: PreferencePolicy = {
      version: "1.0",
      weights: { efficiency: 1 },
      constraints: [],
      contextRules: [
        {
          context: "work",
          adjust: {
            constraintsAdd: [
              { id: "require_confirm_if", params: { stakeGte: 0.5 } },
              "no_irreversible_changes",
            ],
          },
        },
      ],
      uncertaintyThreshold: 0.5,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 }
    };

    const canonical = canonicalizePolicy(policy, registry);
    const addSpecs = canonical.contextRules[0].adjust.constraintsAdd!;
    const firstId = typeof addSpecs[0] === "string" ? addSpecs[0] : addSpecs[0].id;
    const secondId = typeof addSpecs[1] === "string" ? addSpecs[1] : addSpecs[1].id;
    expect(firstId.localeCompare(secondId)).toBeLessThanOrEqual(0);
  });
});
