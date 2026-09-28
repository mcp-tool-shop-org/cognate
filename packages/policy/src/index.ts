/**
 * @cognate/policy — AI Policy Evaluation Engine
 *
 * Pure functions for evaluating governance policies against AI events.
 * Zero side effects. All state must be supplied by the caller.
 *
 * Usage:
 *   import { evaluatePolicy } from "@cognate/policy";
 *   const result = evaluatePolicy(policy, context);
 *   if (result.overall === "deny") { block the request }
 */

export { evaluatePolicy, hasCapability, isCapabilityActive } from "./evaluator.js";
export type { EvaluationContext, PolicyResult, RuleResult } from "./types.js";
