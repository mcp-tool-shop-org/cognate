import { describe, it, expect } from "vitest";
import { planFromMcpToolCall, feedbackFromMcpResult } from "../src/policy/mcp-adapter.js";

describe("planFromMcpToolCall", () => {
  it("creates valid Plan with correct step", () => {
    const plan = planFromMcpToolCall({ name: "file_write", arguments: { path: "/tmp/test" } });

    expect(plan.id).toBe("file_write");
    expect(plan.summary).toBe("file_write");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].kind).toBe("file_write");
    expect(plan.steps[0].detail).toContain("/tmp/test");
    expect(plan.meta.tags).toEqual([]);
  });

  it("creates plan with empty detail when no arguments", () => {
    const plan = planFromMcpToolCall({ name: "list_files" });

    expect(plan.steps[0].detail).toBe("{}");
  });

  it("merges meta overrides", () => {
    const plan = planFromMcpToolCall(
      { name: "deploy", arguments: { env: "prod" } },
      { stake: 0.9, tags: ["deploy", "production"], reversibility: 0 }
    );

    expect(plan.meta.stake).toBe(0.9);
    expect(plan.meta.tags).toEqual(["deploy", "production"]);
    expect(plan.meta.reversibility).toBe(0);
  });
});

describe("feedbackFromMcpResult", () => {
  it("with isError returns UNDO event", () => {
    const event = feedbackFromMcpResult({ content: "error", isError: true }, "my-plan");

    expect(event.type).toBe("UNDO");
    expect(event.editedPlanId).toBe("my-plan");
    expect(event.timestamp).toBeDefined();
  });

  it("without error returns CHOOSE_PLAN event", () => {
    const event = feedbackFromMcpResult({ content: "success" }, "my-plan");

    expect(event.type).toBe("CHOOSE_PLAN");
    expect(event.editedPlanId).toBe("my-plan");
    expect(event.timestamp).toBeDefined();
  });
});
