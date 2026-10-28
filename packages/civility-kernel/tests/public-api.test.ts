import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

describe("public api", () => {
  it("exports the core surface", () => {
    expect(api.DecisionEngine).toBeTypeOf("function");
    expect(api.ConstraintRegistry).toBeTypeOf("function");
    expect(api.ScorerRegistry).toBeTypeOf("function");
    expect(api.registerDefaultConstraints).toBeTypeOf("function");
    expect(api.registerDefaultScorers).toBeTypeOf("function");
  });

  it("exports lintPolicy", () => {
    expect(api.lintPolicy).toBeTypeOf("function");
  });

  it("exports diffPolicy", () => {
    expect(api.diffPolicy).toBeTypeOf("function");
  });

  it("exports canonicalizePolicy", () => {
    expect(api.canonicalizePolicy).toBeTypeOf("function");
  });

  it("exports explainPolicy", () => {
    expect(api.explainPolicy).toBeTypeOf("function");
  });

  it("exports proposePolicyUpdates", () => {
    expect(api.proposePolicyUpdates).toBeTypeOf("function");
  });

  it("exports extractTags", () => {
    expect(api.extractTags).toBeTypeOf("function");
  });

  it("exports annotatePlanWithTags", () => {
    expect(api.annotatePlanWithTags).toBeTypeOf("function");
  });

  it("exports compileEffectivePolicy", () => {
    expect(api.compileEffectivePolicy).toBeTypeOf("function");
  });
});
