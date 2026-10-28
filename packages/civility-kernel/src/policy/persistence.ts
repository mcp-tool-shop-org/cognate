import { z } from "zod";
import { PreferencePolicy } from "./types.js";

const ConstraintSpecSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const ContextRuleSchema = z.object({
  context: z.string(),
  when: z
    .object({
      minStake: z.number().optional(),
      maxUncertainty: z.number().optional(),
      tagsAny: z.array(z.string()).optional(),
    })
    .optional(),
  adjust: z.object({
    weights: z.record(z.string(), z.number()).optional(),
    constraintsAdd: z.array(ConstraintSpecSchema).optional(),
    constraintsRemove: z.array(z.string()).optional(),
    uncertaintyThreshold: z.number().optional(),
    calibration: z
      .object({
        riskTolerance: z.number().min(0).max(1).optional(),
        verbosity: z.number().min(0).max(1).optional(),
        initiative: z.number().min(0).max(1).optional(),
      })
      .optional(),
  }),
});

export const PreferencePolicySchema = z.object({
  version: z.string(),
  weights: z.record(z.string(), z.number().min(0)),
  constraints: z.array(ConstraintSpecSchema),
  contextRules: z.array(ContextRuleSchema),
  uncertaintyThreshold: z.number().min(0).max(1),
  memory: z.record(z.string(), z.unknown()),
  calibration: z.object({
    riskTolerance: z.number().min(0).max(1),
    verbosity: z.number().min(0).max(1),
    initiative: z.number().min(0).max(1),
  }),
});

export function loadPolicy(json: unknown): PreferencePolicy {
  const result = PreferencePolicySchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Invalid policy: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }
  return result.data as PreferencePolicy;
}

function stableSortReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export function dumpPolicy(policy: PreferencePolicy): string {
  return JSON.stringify(policy, stableSortReplacer, 2);
}
