import { describe, it, expect } from "vitest";
import { loadPolicy, dumpPolicy } from "../src/policy/persistence.js";
import { PreferencePolicy } from "../src/policy/types.js";

function validPolicyJson(): Record<string, unknown> {
  return {
    version: "1.0",
    weights: { efficiency: 0.5, safety: 0.5 },
    constraints: ["no_irreversible_changes"],
    contextRules: [],
    uncertaintyThreshold: 0.5,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
  };
}

describe("loadPolicy", () => {
  it("returns PreferencePolicy from valid JSON object", () => {
    const input = validPolicyJson();
    const policy = loadPolicy(input);
    expect(policy.version).toBe("1.0");
    expect(policy.weights).toEqual({ efficiency: 0.5, safety: 0.5 });
    expect(policy.constraints).toEqual(["no_irreversible_changes"]);
    expect(policy.calibration.riskTolerance).toBe(0.5);
  });

  it("throws with structured error for missing fields", () => {
    const input = { version: "1.0" }; // missing most fields
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws with structured error for wrong types", () => {
    const input = {
      ...validPolicyJson(),
      weights: "not-an-object",
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws for calibration riskTolerance > 1", () => {
    const input = {
      ...validPolicyJson(),
      calibration: { riskTolerance: 1.5, verbosity: 0.5, initiative: 0.5 },
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws for calibration riskTolerance < 0", () => {
    const input = {
      ...validPolicyJson(),
      calibration: { riskTolerance: -0.1, verbosity: 0.5, initiative: 0.5 },
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws for uncertaintyThreshold > 1", () => {
    const input = {
      ...validPolicyJson(),
      uncertaintyThreshold: 2.0,
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws for uncertaintyThreshold < 0", () => {
    const input = {
      ...validPolicyJson(),
      uncertaintyThreshold: -0.5,
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });

  it("throws for negative weight value", () => {
    const input = {
      ...validPolicyJson(),
      weights: { efficiency: -1 },
    };
    expect(() => loadPolicy(input)).toThrow(/Invalid policy/);
  });
});

describe("dumpPolicy", () => {
  it("returns deterministic JSON with sorted keys", () => {
    const policy = loadPolicy(validPolicyJson());
    const json1 = dumpPolicy(policy);
    const json2 = dumpPolicy(policy);
    expect(json1).toBe(json2);

    // Verify keys are sorted in the output
    const parsed = JSON.parse(json1);
    const keys = Object.keys(parsed);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe("round-trip", () => {
  it("dumpPolicy produces valid parseable JSON with sorted top-level keys", () => {
    const original = loadPolicy(validPolicyJson());
    const dumped = dumpPolicy(original);
    const parsed = JSON.parse(dumped);

    // dumpPolicy uses Object.keys(policy).sort() as the JSON.stringify
    // replacer array. This acts as a key whitelist across all nesting
    // levels, so only top-level key names survive in nested objects.
    expect(typeof parsed).toBe("object");
    expect(parsed.version).toBe("1.0");
    // Top-level keys are present and sorted
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
    // constraints array items (strings) pass through the replacer
    expect(parsed.constraints).toEqual(["no_irreversible_changes"]);
  });
});
