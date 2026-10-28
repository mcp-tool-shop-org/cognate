import { describe, it, expect } from "vitest";
import { PolicyBuilder } from "../src/policy/builder.js";

describe("PolicyBuilder", () => {
  it("builds a valid policy with defaults", () => {
    const policy = new PolicyBuilder().build();
    expect(policy.version).toBe("1.0");
    expect(policy.uncertaintyThreshold).toBe(0.5);
    expect(policy.calibration).toEqual({
      riskTolerance: 0.5,
      verbosity: 0.5,
      initiative: 0.5,
    });
    expect(policy.constraints).toEqual([]);
    expect(policy.contextRules).toEqual([]);
    expect(policy.weights).toEqual({});
    expect(policy.memory).toEqual({});
  });

  it("builds correctly with all methods chained", () => {
    const policy = new PolicyBuilder()
      .setVersion("2.0")
      .setWeight("efficiency", 0.7)
      .setWeight("safety", 0.3)
      .addConstraint("no_irreversible_changes")
      .addConstraint({ id: "max_spend_without_confirm", params: { amount: 100 } })
      .setUncertaintyThreshold(0.8)
      .setCalibration({ riskTolerance: 0.2, verbosity: 0.9, initiative: 0.1 })
      .addContextRule({
        context: "production",
        adjust: { weights: { safety: 0.9 } },
      })
      .build();

    expect(policy.version).toBe("2.0");
    expect(policy.weights).toEqual({ efficiency: 0.7, safety: 0.3 });
    expect(policy.constraints).toHaveLength(2);
    expect(policy.uncertaintyThreshold).toBe(0.8);
    expect(policy.calibration.riskTolerance).toBe(0.2);
    expect(policy.calibration.verbosity).toBe(0.9);
    expect(policy.calibration.initiative).toBe(0.1);
    expect(policy.contextRules).toHaveLength(1);
    expect(policy.contextRules[0].context).toBe("production");
  });

  it("throws on build() with invalid weight (< 0)", () => {
    const builder = new PolicyBuilder().setWeight("bad", -1);
    expect(() => builder.build()).toThrow(/Invalid policy/);
  });

  it("throws on build() with invalid uncertaintyThreshold (> 1)", () => {
    const builder = new PolicyBuilder().setUncertaintyThreshold(1.5);
    expect(() => builder.build()).toThrow(/Invalid policy/);
  });

  it("can add constraints and context rules", () => {
    const policy = new PolicyBuilder()
      .addConstraint("no_irreversible_changes")
      .addConstraint({ id: "require_confirm_if", params: { stakeGte: 0.8 } })
      .addContextRule({
        context: "tool:*",
        adjust: { constraintsAdd: ["no_irreversible_changes"] },
      })
      .build();

    expect(policy.constraints).toHaveLength(2);
    expect(policy.contextRules).toHaveLength(1);
  });
});
