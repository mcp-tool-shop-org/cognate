import { describe, it, expect } from "vitest";
import { explainPolicy } from "../src/policy/explain.js";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { PreferencePolicy } from "../src/policy/types.js";

function makePolicy(overrides?: Partial<PreferencePolicy>): PreferencePolicy {
  return {
    version: "1.0",
    weights: { efficiency: 0.6, low_risk: 0.3, concise: 0.1 },
    constraints: ["no_irreversible_changes"],
    contextRules: [],
    uncertaintyThreshold: 0.4,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
    ...overrides,
  };
}

function makeRegistry(): ConstraintRegistry {
  const reg = new ConstraintRegistry();
  registerDefaultConstraints(reg);
  return reg;
}

describe("explainPolicy", () => {
  it("returns a summary with constraint/weight/rule counts", () => {
    const result = explainPolicy(makePolicy(), makeRegistry());
    expect(result.summary).toMatch(/1 constraints/);
    expect(result.summary).toMatch(/3 weights/);
    expect(result.summary).toMatch(/0 context rules/);
  });

  it("includes uncertainty threshold in output", () => {
    const result = explainPolicy(makePolicy(), makeRegistry());
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/0\.40/);
    expect(joined).toMatch(/uncertainty/i);
  });

  it("lists weight percentages", () => {
    const result = explainPolicy(makePolicy(), makeRegistry());
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/efficiency/);
    expect(joined).toMatch(/60%/);
  });

  it("includes calibration values", () => {
    const result = explainPolicy(
      makePolicy({ calibration: { riskTolerance: 0.7, verbosity: 0.3, initiative: 0.9 } }),
      makeRegistry()
    );
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/0\.70/);
    expect(joined).toMatch(/0\.30/);
    expect(joined).toMatch(/0\.90/);
  });

  it("uses markdown formatting when format is markdown", () => {
    const result = explainPolicy(makePolicy(), makeRegistry(), { format: "markdown" });
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/^## /m);
    expect(joined).toMatch(/^- /m);
  });

  it("uses text formatting by default", () => {
    const result = explainPolicy(makePolicy(), makeRegistry(), { format: "text" });
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/•/);
    expect(joined).not.toMatch(/^## /m);
  });

  it("warns on unknown constraints", () => {
    const policy = makePolicy({ constraints: ["no_irreversible_changes", "bogus_constraint"] });
    const result = explainPolicy(policy, makeRegistry());
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/bogus_constraint/);
    expect(result.warnings[0]).toMatch(/unknown/i);
  });

  it("warns on invalid constraint params", () => {
    const policy = makePolicy({
      constraints: [{ id: "max_spend_without_confirm", params: { amount: "not_a_number" } }],
    });
    const result = explainPolicy(policy, makeRegistry());
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/max_spend_without_confirm/);
  });

  it("shows context rules when present", () => {
    const policy = makePolicy({
      contextRules: [
        {
          context: "work",
          when: { minStake: 0.5, tagsAny: ["spend_money"] },
          adjust: {
            weights: { efficiency: 0.8 },
            constraintsAdd: [{ id: "max_spend_without_confirm", params: { amount: 50 } }],
            constraintsRemove: ["no_irreversible_changes"],
          },
        },
      ],
    });
    const result = explainPolicy(policy, makeRegistry(), { format: "text" });
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/work/);
    expect(joined).toMatch(/minStake/);
    expect(joined).toMatch(/spend_money/);
    expect(joined).toMatch(/Add constraints/);
    expect(joined).toMatch(/Remove constraints/);
  });

  it("shows memory keys when includeMemoryKeys is true", () => {
    const policy = makePolicy({ memory: { favColor: "blue", lang: "en" } });
    const result = explainPolicy(policy, makeRegistry(), { includeMemoryKeys: true });
    const joined = result.lines.join("\n");
    expect(joined).toMatch(/favColor/);
    expect(joined).toMatch(/lang/);
  });

  it("omits weights section when includeWeights is false", () => {
    const result = explainPolicy(makePolicy(), makeRegistry(), { includeWeights: false });
    const joined = result.lines.join("\n");
    expect(joined).not.toMatch(/Tradeoffs/i);
    expect(joined).not.toMatch(/60%/);
  });

  it("omits calibration section when includeCalibration is false", () => {
    const result = explainPolicy(makePolicy(), makeRegistry(), { includeCalibration: false });
    const joined = result.lines.join("\n");
    expect(joined).not.toMatch(/calibration/i);
  });

  it("returns no warnings for a fully valid policy", () => {
    const result = explainPolicy(makePolicy(), makeRegistry());
    expect(result.warnings).toEqual([]);
  });
});
