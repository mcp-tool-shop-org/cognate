// The three fixes made when civility-kernel moved into Cognate: the compile cache, caller-supplied ids and times,
// and a utility that survives JSON.
import { describe, it, expect } from "vitest";
import { canonicalize } from "json-canonicalize";
import { ConstraintRegistry, registerDefaultConstraints } from "../src/policy/constraints.js";
import { ScorerRegistry, registerDefaultScorers } from "../src/policy/scoring.js";
import { DecisionEngine } from "../src/policy/decision.js";
import { compileEffectivePolicy, computeCacheKey } from "../src/policy/context.js";
import { createKernel } from "../src/policy/kernel.js";
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

// fast-risky wins on efficiency, slow-safe wins on low_risk.
const plans: Plan[] = [
  { id: "fast-risky", summary: "Fast", steps: [], meta: { estimatedTimeSec: 5, stake: 1, reversibility: 1 } },
  { id: "slow-safe", summary: "Slow", steps: [], meta: { estimatedTimeSec: 600, stake: 0, reversibility: 1 } },
];

const ID = { decisionId: "dec-0001", timestamp: "2026-10-28T00:00:00.000Z" };

describe("compile cache regression", () => {
  it("two policies with the same version and context but different weights choose differently", () => {
    const engine = setup();
    const speed = makePolicy({ weights: { efficiency: 1, low_risk: 0 } });
    const safety = makePolicy({ weights: { efficiency: 0, low_risk: 1 } });

    const a = engine.decide(speed, "ctx", plans);
    const b = engine.decide(safety, "ctx", plans);

    expect(a.trace.chosenPlanId).toBe("fast-risky");
    expect(b.trace.chosenPlanId).toBe("slow-safe");
    expect(b.trace.effectivePolicy.weights).toEqual({ efficiency: 0, low_risk: 1 });
  });

  it("two policies with the same version and context but different constraints compile differently", () => {
    const loose = makePolicy();
    const strict = makePolicy({ constraints: ["no_irreversible_changes"] });

    expect(compileEffectivePolicy(loose, "ctx", plans).policy.constraints).toEqual([]);
    expect(compileEffectivePolicy(strict, "ctx", plans).policy.constraints).toEqual(["no_irreversible_changes"]);
  });

  it("computeCacheKey changes with weights, constraints and threshold, not only version", () => {
    const base = computeCacheKey(makePolicy(), "ctx", plans);
    expect(computeCacheKey(makePolicy({ weights: { efficiency: 0.5 } }), "ctx", plans)).not.toBe(base);
    expect(computeCacheKey(makePolicy({ constraints: ["no_irreversible_changes"] }), "ctx", plans)).not.toBe(base);
    expect(computeCacheKey(makePolicy({ uncertaintyThreshold: 0.2 }), "ctx", plans)).not.toBe(base);
  });
});

describe("caller-supplied decisionId and timestamp", () => {
  it("decide gives a byte-identical trace for the same inputs", () => {
    const policy = makePolicy({ weights: { efficiency: 1, low_risk: 1 } });
    const a = setup().decide(policy, "ctx", plans, ID);
    const b = setup().decide(policy, "ctx", plans, ID);
    expect(a.trace.decisionId).toBe(ID.decisionId);
    expect(a.trace.timestamp).toBe(ID.timestamp);
    expect(canonicalize(a.trace)).toBe(canonicalize(b.trace));
    expect(JSON.stringify(a.trace)).toBe(JSON.stringify(b.trace));
  });

  it("decideAsync gives a byte-identical trace for the same inputs, and matches decide", async () => {
    const policy = makePolicy();
    const a = await setup().decideAsync(policy, "ctx", plans, ID);
    const b = await setup().decideAsync(policy, "ctx", plans, ID);
    expect(canonicalize(a.trace)).toBe(canonicalize(b.trace));
    expect(canonicalize(a.trace)).toBe(canonicalize(setup().decide(policy, "ctx", plans, ID).trace));
  });

  it("uses them on the no-plans path too", async () => {
    const engine = setup();
    expect(engine.decide(makePolicy(), "ctx", [], ID).trace).toMatchObject(ID);
    expect((await engine.decideAsync(makePolicy(), "ctx", [], ID)).trace).toMatchObject(ID);
  });

  it("the Kernel wrappers pass them through", async () => {
    const kernel = createKernel({ policy: makePolicy() });
    expect(kernel.decide("ctx", plans, ID)).toMatchObject(ID);
    expect(await kernel.decideAsync("ctx", plans, ID)).toMatchObject(ID);
  });

  it("without them, each decision still gets its own id and the current time", () => {
    const engine = setup();
    const a = engine.decide(makePolicy(), "ctx", plans);
    const b = engine.decide(makePolicy(), "ctx", plans);
    expect(a.trace.decisionId).not.toBe(b.trace.decisionId);
    expect(Number.isNaN(Date.parse(a.trace.timestamp))).toBe(false);
  });
});

describe("utility of a failed plan", () => {
  const strict = makePolicy({ constraints: ["no_irreversible_changes"] });
  const mixed: Plan[] = [
    { id: "drop-table", summary: "Irreversible", steps: [], meta: { reversibility: 0 } },
    { id: "backup-first", summary: "Reversible", steps: [], meta: { reversibility: 1 } },
  ];

  it("is null, and a passing plan's is a finite number", () => {
    const { trace } = setup().decide(strict, "ctx", mixed, ID);
    const [failed, passed] = trace.candidates.map((c) => c.eval);
    expect(failed.passesConstraints).toBe(false);
    expect(failed.utility).toBeNull();
    expect(Number.isFinite(passed.utility)).toBe(true);
    expect(trace.chosenPlanId).toBe("backup-first");
  });

  it("is null from decideAsync too", async () => {
    const { trace } = await setup().decideAsync(strict, "ctx", mixed, ID);
    expect(trace.candidates[0].eval.utility).toBeNull();
  });

  it("lets a trace survive a JSON round-trip unchanged", () => {
    const { trace } = setup().decide(strict, "ctx", mixed, ID);
    const parsed = JSON.parse(JSON.stringify(trace));
    expect(parsed).toEqual(trace);
    expect(canonicalize(parsed)).toBe(canonicalize(trace));
  });
});
