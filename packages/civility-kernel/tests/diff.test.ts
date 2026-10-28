import { describe, it, expect } from "vitest";
import { diffPolicy } from "../src/policy/diff.js";
import { PreferencePolicy } from "../src/policy/types.js";

function makePolicy(overrides?: Partial<PreferencePolicy>): PreferencePolicy {
  return {
    version: "1.0",
    weights: { efficiency: 1, low_risk: 0.5 },
    constraints: ["no_irreversible_changes", { id: "max_spend_without_confirm", params: { amount: 20 } }],
    contextRules: [],
    uncertaintyThreshold: 0.5,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
    ...overrides,
  };
}

describe("diffPolicy", () => {
  const basePolicy = makePolicy();

  it("detects no changes with two independently constructed equal objects", () => {
    const a = makePolicy();
    const b = makePolicy();
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(false);
    expect(diff.items).toHaveLength(0);
  });

  it("detects weight changes", () => {
    const newPolicy = {
      ...basePolicy,
      weights: { efficiency: 0.8, concise: 1 }
    };
    const diff = diffPolicy(basePolicy, newPolicy);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "weight_changed", path: "weights.efficiency" }));
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "weight_removed", path: "weights.low_risk" }));
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "weight_added", path: "weights.concise" }));
  });

  it("detects constraint param changes as remove+add", () => {
    const newPolicy = {
      ...basePolicy,
      constraints: ["no_irreversible_changes", { id: "max_spend_without_confirm", params: { amount: 200 } }]
    };
    const diff = diffPolicy(basePolicy, newPolicy);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "constraint_removed" }));
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "constraint_added" }));
  });

  it("detects threshold_changed", () => {
    const a = makePolicy({ uncertaintyThreshold: 0.3 });
    const b = makePolicy({ uncertaintyThreshold: 0.7 });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "threshold_changed" }));
  });

  it("detects calibration_changed", () => {
    const a = makePolicy({ calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 } });
    const b = makePolicy({ calibration: { riskTolerance: 0.9, verbosity: 0.5, initiative: 0.5 } });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "calibration_changed" }));
  });

  it("detects context_rule_added", () => {
    const a = makePolicy({ contextRules: [] });
    const b = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { efficiency: 2 } } }],
    });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "context_rule_added" }));
  });

  it("detects context_rule_removed", () => {
    const a = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { efficiency: 2 } } }],
    });
    const b = makePolicy({ contextRules: [] });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "context_rule_removed" }));
  });

  it("detects context_rule_changed", () => {
    const a = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { efficiency: 2 } } }],
    });
    const b = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { efficiency: 5 } } }],
    });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(true);
    expect(diff.items).toContainEqual(expect.objectContaining({ kind: "context_rule_changed" }));
  });

  it("stableJson: context rules with same properties in different key order produce no diff", () => {
    const a = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { alpha: 1, beta: 2 } } }],
    });
    const b = makePolicy({
      contextRules: [{ context: "work", adjust: { weights: { beta: 2, alpha: 1 } } }],
    });
    const diff = diffPolicy(a, b);
    expect(diff.changed).toBe(false);
  });
});
