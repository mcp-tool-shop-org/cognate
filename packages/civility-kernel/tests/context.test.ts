import { describe, it, expect } from "vitest";
import { matchesContext, computeCacheKey, compileEffectivePolicy } from "../src/policy/context.js";
import { PreferencePolicy, Plan } from "../src/policy/types.js";

function makePolicy(overrides?: Partial<PreferencePolicy>): PreferencePolicy {
  return {
    version: "1.0",
    weights: { efficiency: 1 },
    constraints: [],
    contextRules: [],
    uncertaintyThreshold: 0.5,
    memory: {},
    calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
    ...overrides,
  };
}

function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: "p1",
    summary: "Test",
    steps: [],
    meta: { reversibility: 1 },
    ...overrides,
  };
}

describe("matchesContext (glob)", () => {
  it("tool:* matches tool:file_write", () => {
    expect(matchesContext("tool:*", "tool:file_write")).toBe(true);
  });

  it("tool:* does not match other:thing", () => {
    expect(matchesContext("tool:*", "other:thing")).toBe(false);
  });

  it("exact match works", () => {
    expect(matchesContext("exact", "exact")).toBe(true);
  });

  it("a:*:c matches a:b:c", () => {
    expect(matchesContext("a:*:c", "a:b:c")).toBe(true);
  });

  it("a:*:c does not match a:b:d", () => {
    expect(matchesContext("a:*:c", "a:b:d")).toBe(false);
  });

  it("exact matches take priority over glob in context rule application", () => {
    const policy = makePolicy({
      version: "exact-priority-test",
      weights: { efficiency: 1 },
      contextRules: [
        {
          context: "tool:*",
          adjust: { uncertaintyThreshold: 0.9 },
        },
        {
          context: "tool:file_write",
          adjust: { uncertaintyThreshold: 0.2 },
        },
      ],
    });

    const plans = [makePlan()];
    const result = compileEffectivePolicy(policy, "tool:file_write", plans);

    // Both rules match; exact match sorted first in application order
    expect(result.appliedContextRules.length).toBe(2);
    // The exact match should be listed first due to sort order
    expect(result.appliedContextRules[0].context).toBe("tool:file_write");
  });

  it("specificity ordering: most literal characters first", () => {
    const policy = makePolicy({
      version: "specificity-test",
      contextRules: [
        {
          context: "tool:*",
          adjust: { uncertaintyThreshold: 0.1 },
        },
        {
          context: "tool:file_*",
          adjust: { uncertaintyThreshold: 0.9 },
        },
      ],
    });

    const plans = [makePlan()];
    // "tool:file_write" matches both "tool:*" and "tool:file_*"
    // (since * matches [^:]*, "file_write" is a single segment)
    const result = compileEffectivePolicy(policy, "tool:file_write", plans);

    // Both match; more specific "tool:file_*" (9 literal chars) sorted before "tool:*" (4 literal chars)
    expect(result.appliedContextRules.length).toBe(2);
    expect(result.appliedContextRules[0].context).toBe("tool:file_*");
  });
});

describe("computeCacheKey", () => {
  it("returns same key for same inputs", () => {
    const policy = makePolicy();
    const plans = [makePlan()];
    const key1 = computeCacheKey(policy, "ctx", plans);
    const key2 = computeCacheKey(policy, "ctx", plans);
    expect(key1).toBe(key2);
  });

  it("returns different key when context changes", () => {
    const policy = makePolicy();
    const plans = [makePlan()];
    const key1 = computeCacheKey(policy, "ctx-a", plans);
    const key2 = computeCacheKey(policy, "ctx-b", plans);
    expect(key1).not.toBe(key2);
  });
});

describe("compileEffectivePolicy purity", () => {
  // Before the move into Cognate, a module-level cache returned the same object for repeat calls; these now pin
  // the opposite: equal results, never a shared object.
  it("returns an equal but separate result on same inputs", () => {
    const policy = makePolicy({
      version: "cache-identity-test",
      contextRules: [
        { context: "cache-test", adjust: { uncertaintyThreshold: 0.9 } },
      ],
    });
    const plans = [makePlan()];

    const result1 = compileEffectivePolicy(policy, "cache-test", plans);
    const result2 = compileEffectivePolicy(policy, "cache-test", plans);

    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
    result1.policy.weights.efficiency = 99;
    expect(result2.policy.weights.efficiency).not.toBe(99);
  });

  it("returns different result when inputs change", () => {
    const policy = makePolicy({
      version: "cache-diff-test",
      contextRules: [
        { context: "cache-a", adjust: { uncertaintyThreshold: 0.1 } },
        { context: "cache-b", adjust: { uncertaintyThreshold: 0.9 } },
      ],
    });
    const plans = [makePlan()];

    const result1 = compileEffectivePolicy(policy, "cache-a", plans);
    const result2 = compileEffectivePolicy(policy, "cache-b", plans);

    expect(result1).not.toBe(result2);
  });
});
