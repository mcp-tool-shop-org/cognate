import { describe, it, expect } from "vitest";
import { proposePolicyUpdates, applyPolicyProposal, FeedbackEvent } from "../src/policy/learning.js";
import { PreferencePolicy } from "../src/policy/types.js";

function makePolicy(overrides?: Partial<PreferencePolicy["calibration"]>): PreferencePolicy {
  return {
    version: "1.0",
    weights: { efficiency: 0.5, low_risk: 0.3, concise: 0.2 },
    constraints: [],
    contextRules: [],
    uncertaintyThreshold: 0.5,
    memory: {},
    calibration: {
      riskTolerance: 0.5,
      verbosity: 0.5,
      initiative: 0.5,
      ...overrides,
    },
  };
}

function makeEvents(
  type: FeedbackEvent["type"],
  count: number,
  weightKey?: string
): FeedbackEvent[] {
  return Array.from({ length: count }, () => ({
    type,
    weightKey,
    timestamp: new Date().toISOString(),
  }));
}

describe("proposePolicyUpdates", () => {
  it("proposes reducing initiative after 3+ UNDOs", () => {
    const policy = makePolicy({ initiative: 0.5 });
    const events = makeEvents("UNDO", 3);
    const proposals = proposePolicyUpdates(policy, events);

    expect(proposals.length).toBeGreaterThanOrEqual(1);
    const initiativePatch = proposals.find((p) => p.patch.calibration?.initiative !== undefined);
    expect(initiativePatch).toBeDefined();
    expect(initiativePatch!.patch.calibration!.initiative).toBe(0.4);
    expect(initiativePatch!.reason).toMatch(/undo/i);
  });

  it("does not propose initiative change below 3 UNDOs", () => {
    const policy = makePolicy({ initiative: 0.5 });
    const events = makeEvents("UNDO", 2);
    const proposals = proposePolicyUpdates(policy, events);

    const initiativePatch = proposals.find((p) => p.patch.calibration?.initiative !== undefined);
    expect(initiativePatch).toBeUndefined();
  });

  it("clamps initiative at 0", () => {
    const policy = makePolicy({ initiative: 0.05 });
    const events = makeEvents("UNDO", 5);
    const proposals = proposePolicyUpdates(policy, events);

    const initiativePatch = proposals.find((p) => p.patch.calibration?.initiative !== undefined);
    expect(initiativePatch).toBeDefined();
    expect(initiativePatch!.patch.calibration!.initiative).toBe(0);
  });

  it("proposes reducing verbosity after 2+ THUMBS_DOWN on concise", () => {
    const policy = makePolicy({ verbosity: 0.6 });
    const events = makeEvents("THUMBS_DOWN", 2, "concise");
    const proposals = proposePolicyUpdates(policy, events);

    const verbPatch = proposals.find((p) => p.patch.calibration?.verbosity !== undefined);
    expect(verbPatch).toBeDefined();
    expect(verbPatch!.patch.calibration!.verbosity).toBeCloseTo(0.5);
    expect(verbPatch!.reason).toMatch(/verbose/i);
  });

  it("does not propose verbosity change for THUMBS_DOWN on other weights", () => {
    const policy = makePolicy({ verbosity: 0.6 });
    const events = makeEvents("THUMBS_DOWN", 5, "efficiency");
    const proposals = proposePolicyUpdates(policy, events);

    const verbPatch = proposals.find((p) => p.patch.calibration?.verbosity !== undefined);
    expect(verbPatch).toBeUndefined();
  });

  it("proposes user clarification after 5+ THUMBS_DOWN with no other proposals", () => {
    const policy = makePolicy();
    const events = makeEvents("THUMBS_DOWN", 5, "efficiency");
    const proposals = proposePolicyUpdates(policy, events);

    expect(proposals.length).toBe(1);
    expect(proposals[0].reason).toMatch(/clarification/i);
    expect(Object.keys(proposals[0].patch)).toHaveLength(0);
  });

  it("does not propose clarification if other patches already proposed", () => {
    const policy = makePolicy({ initiative: 0.5 });
    // 3 UNDOs + 5 THUMBS_DOWN on efficiency — undo patch fires, so clarification should not
    const events = [
      ...makeEvents("UNDO", 3),
      ...makeEvents("THUMBS_DOWN", 5, "efficiency"),
    ];
    const proposals = proposePolicyUpdates(policy, events);

    const clarification = proposals.find((p) => p.reason.match(/clarification/i));
    expect(clarification).toBeUndefined();
  });

  it("returns empty proposals for positive-only feedback", () => {
    const policy = makePolicy();
    const events = [
      ...makeEvents("THUMBS_UP", 10),
      ...makeEvents("CHOOSE_PLAN", 5),
    ];
    const proposals = proposePolicyUpdates(policy, events);
    expect(proposals).toEqual([]);
  });

  // FT-010: Extended Feedback Events
  it("2+ CONSTRAINT_RELAXED on same constraintId proposes removing that constraint", () => {
    const policy: PreferencePolicy = {
      ...makePolicy(),
      constraints: ["no_irreversible_changes", "max_spend"],
    };
    const events: FeedbackEvent[] = [
      { type: "CONSTRAINT_RELAXED", constraintId: "no_irreversible_changes", timestamp: new Date().toISOString() },
      { type: "CONSTRAINT_RELAXED", constraintId: "no_irreversible_changes", timestamp: new Date().toISOString() },
    ];

    const proposals = proposePolicyUpdates(policy, events);
    const removeProp = proposals.find((p) => p.reason.includes("no_irreversible_changes"));
    expect(removeProp).toBeDefined();
    expect(removeProp!.needsHumanReview).toBe(true);
    // Patch should contain constraints without the relaxed one
    expect(removeProp!.patch.constraints).toBeDefined();
    expect(removeProp!.patch.constraints!.includes("no_irreversible_changes")).toBe(false);
    // Other constraints are preserved
    expect(removeProp!.patch.constraints!.includes("max_spend")).toBe(true);
  });

  it("3+ TIMEOUT events proposes reducing initiative", () => {
    const policy = makePolicy({ initiative: 0.5 });
    const events: FeedbackEvent[] = [
      { type: "TIMEOUT", timestamp: new Date().toISOString() },
      { type: "TIMEOUT", timestamp: new Date().toISOString() },
      { type: "TIMEOUT", timestamp: new Date().toISOString() },
    ];

    const proposals = proposePolicyUpdates(policy, events);
    const initPatch = proposals.find(
      (p) => p.patch.calibration?.initiative !== undefined && p.reason.match(/timeout|overreaching/i)
    );
    expect(initPatch).toBeDefined();
    expect(initPatch!.patch.calibration!.initiative).toBeLessThan(0.5);
  });

  it("PLAN_EDITED counts toward undo threshold", () => {
    const policy = makePolicy({ initiative: 0.5 });
    // 3 PLAN_EDITED events should trigger the undo+plan-edit proposal
    const events: FeedbackEvent[] = [
      { type: "PLAN_EDITED", editedPlanId: "a", timestamp: new Date().toISOString() },
      { type: "PLAN_EDITED", editedPlanId: "b", timestamp: new Date().toISOString() },
      { type: "PLAN_EDITED", editedPlanId: "c", timestamp: new Date().toISOString() },
    ];

    const proposals = proposePolicyUpdates(policy, events);
    const initPatch = proposals.find(
      (p) => p.patch.calibration?.initiative !== undefined && p.reason.match(/undo|plan-edit|proactive/i)
    );
    expect(initPatch).toBeDefined();
    expect(initPatch!.patch.calibration!.initiative).toBe(0.4);
  });
});

// FT-004: Apply Policy Proposals
describe("applyPolicyProposal", () => {
  function makeFullPolicy(overrides?: Partial<PreferencePolicy>): PreferencePolicy {
    return {
      version: "1.0",
      weights: { efficiency: 0.5, low_risk: 0.3, concise: 0.2 },
      constraints: ["no_irreversible_changes"],
      contextRules: [],
      uncertaintyThreshold: 0.5,
      memory: {},
      calibration: { riskTolerance: 0.5, verbosity: 0.5, initiative: 0.5 },
      ...overrides,
    };
  }

  it("merges calibration patch with clamping to [0,1]", () => {
    const policy = makeFullPolicy();
    const result = applyPolicyProposal(policy, {
      reason: "test",
      patch: { calibration: { riskTolerance: 0.8, verbosity: 0.5, initiative: 0.5 } },
    });

    expect(result.calibration.riskTolerance).toBe(0.8);
    expect(result.calibration.verbosity).toBe(0.5);
  });

  it("merges weight patch", () => {
    const policy = makeFullPolicy();
    const result = applyPolicyProposal(policy, {
      reason: "test",
      patch: { weights: { newKey: 0.4 } },
    });

    expect(result.weights.newKey).toBe(0.4);
    // Original weights preserved
    expect(result.weights.efficiency).toBe(0.5);
  });

  it("does not mutate original policy", () => {
    const policy = makeFullPolicy();
    const originalInitiative = policy.calibration.initiative;

    applyPolicyProposal(policy, {
      reason: "test",
      patch: { calibration: { riskTolerance: 0.1, verbosity: 0.1, initiative: 0.1 } },
    });

    expect(policy.calibration.initiative).toBe(originalInitiative);
  });

  it("clamps negative calibration to 0", () => {
    const policy = makeFullPolicy();
    const result = applyPolicyProposal(policy, {
      reason: "test",
      patch: { calibration: { riskTolerance: -0.5, verbosity: 0.5, initiative: 0.5 } },
    });

    expect(result.calibration.riskTolerance).toBe(0);
  });

  it("clamps calibration above 1 to 1", () => {
    const policy = makeFullPolicy();
    const result = applyPolicyProposal(policy, {
      reason: "test",
      patch: { calibration: { riskTolerance: 2.0, verbosity: 0.5, initiative: 0.5 } },
    });

    expect(result.calibration.riskTolerance).toBe(1);
  });
});
