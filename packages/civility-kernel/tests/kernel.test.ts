import { describe, it, expect } from "vitest";
import { createKernel } from "../src/policy/kernel.js";
import { PolicyBuilder } from "../src/policy/builder.js";
import { PreferencePolicy, Plan, DecisionTrace } from "../src/policy/types.js";

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

function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: "p1",
    summary: "Test plan",
    steps: [{ kind: "action", detail: "do thing" }],
    meta: { reversibility: 1 },
    ...overrides,
  };
}

describe("createKernel", () => {
  it("with minimal config, kernel.decide works", () => {
    const kernel = createKernel({ policy: makePolicy() });
    const trace = kernel.decide("x", [makePlan()]);

    expect(trace.outcome).toBe("EXECUTE");
    expect(trace.chosenPlanId).toBe("p1");
  });

  it("with custom constraints, constraint is applied", () => {
    const kernel = createKernel({
      policy: makePolicy({ version: "custom-constraint-test", constraints: ["block_all"] }),
      constraints: (reg) => {
        reg.register("block_all", {
          evaluate: (spec) => ({
            ok: false,
            id: spec.id,
            reason: "Blocked by custom constraint",
          }),
        });
      },
    });

    const trace = kernel.decide("custom-constraint-ctx", [makePlan({ id: "blocked-plan" })]);
    expect(trace.outcome).toBe("NO_VALID_PLAN");
  });

  it("kernel.lint() returns LintReport", () => {
    const kernel = createKernel({ policy: makePolicy() });
    const report = kernel.lint();

    expect(report).toBeDefined();
    expect(Array.isArray(report.issues)).toBe(true);
  });

  it("kernel.explain() returns string[]", () => {
    const kernel = createKernel({ policy: makePolicy() });
    const lines = kernel.explain();

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("kernel.updatePolicy() swaps active policy", () => {
    const kernel = createKernel({ policy: makePolicy({ version: "swap-v1", uncertaintyThreshold: 1 }) });

    // First decision with high threshold → EXECUTE
    const trace1 = kernel.decide("swap-ctx", [
      makePlan({ id: "swap-plan", meta: { uncertainty: 0.9, reversibility: 1 } }),
    ]);
    expect(trace1.outcome).toBe("EXECUTE");

    // Swap to low threshold (different version busts compile cache)
    kernel.updatePolicy(makePolicy({ version: "swap-v2", uncertaintyThreshold: 0.1 }));

    // Same plan now triggers ASK_USER
    const trace2 = kernel.decide("swap-ctx", [
      makePlan({ id: "swap-plan", meta: { uncertainty: 0.9, reversibility: 1 } }),
    ]);
    expect(trace2.outcome).toBe("ASK_USER");
  });

  it("kernel.decideAsync() works", async () => {
    const kernel = createKernel({ policy: makePolicy() });
    const trace = await kernel.decideAsync("x", [makePlan()]);

    expect(trace.outcome).toBe("EXECUTE");
    expect(trace.chosenPlanId).toBe("p1");
  });
});
