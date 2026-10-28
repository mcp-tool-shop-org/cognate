import type { PreferencePolicy, ConstraintSpec } from "./types.js";
import type { ConstraintRegistry } from "./constraints.js";
import type { ScorerRegistry } from "./scoring.js";

export type LintSeverity = "error" | "warn" | "info";

export interface LintIssue {
  severity: LintSeverity;
  code:
    | "UNKNOWN_CONSTRAINT"
    | "INVALID_CONSTRAINT_PARAMS"
    | "DUPLICATE_CONSTRAINT"
    | "CONTEXT_CONSTRAINT_CONFLICT"
    | "MISSING_SCORER"
    | "WEIGHTS_SUM_ZERO"
    | "NEGATIVE_WEIGHT"
    | "THRESHOLD_OUT_OF_RANGE";
  message: string;
  path?: string; // e.g. "constraints[2]" or "contextRules[0].adjust"
  meta?: Record<string, unknown>;
}

export interface LintReport {
  ok: boolean;
  issues: LintIssue[];
}

function specId(spec: ConstraintSpec): string {
  return typeof spec === "string" ? spec : spec.id;
}

function specParams(spec: ConstraintSpec): Record<string, unknown> {
  return typeof spec === "string" ? {} : (spec.params ?? {});
}

function stableJson(x: unknown): string {
  // deterministic stringify for hashing duplicates
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(stableJson).join(",")}]`;
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableJson(obj[k])).join(",")}}`;
}

export function lintPolicy(
  policy: PreferencePolicy,
  deps: { registry: ConstraintRegistry; scorers?: ScorerRegistry }
): LintReport {
  const issues: LintIssue[] = [];

  // Threshold sanity
  const thr = policy.uncertaintyThreshold;
  if (thr < 0 || thr > 1) {
    issues.push({
      severity: "error",
      code: "THRESHOLD_OUT_OF_RANGE",
      message: `uncertaintyThreshold must be within [0,1], got ${thr}`,
      path: "uncertaintyThreshold"
    });
  }

  // Weights sanity
  let sum = 0;
  for (const [k, v] of Object.entries(policy.weights)) {
    if (v < 0) {
      issues.push({
        severity: "warn",
        code: "NEGATIVE_WEIGHT",
        message: `Weight "${k}" is negative (${v}). Negative weights are usually unintended.`,
        path: `weights.${k}`,
        meta: { key: k, value: v }
      });
    }
    sum += Math.max(0, v);
  }
  if (sum === 0) {
    issues.push({
      severity: "error",
      code: "WEIGHTS_SUM_ZERO",
      message: "All weights are zero (or negative). The agent cannot meaningfully score surviving plans.",
      path: "weights"
    });
  }

  // Missing scorer keys
  if (deps.scorers) {
    for (const k of Object.keys(policy.weights)) {
      const has = deps.scorers.has(k);

      if (has === false) {
        issues.push({
          severity: "warn",
          code: "MISSING_SCORER",
          message: `Weight "${k}" has no registered scorer. It will contribute 0 utility.`,
          path: `weights.${k}`
        });
      }
    }
  }

  // Constraint checks: unknown + invalid params + duplicates
  const seen = new Set<string>();
  for (let i = 0; i < policy.constraints.length; i++) {
    const spec = policy.constraints[i];
    const id = specId(spec);
    const params = specParams(spec);

    const handler = deps.registry.getHandler(id);
    if (!handler) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_CONSTRAINT",
        message: `Unknown constraint "${id}" (will fail closed).`,
        path: `constraints[${i}]`,
        meta: { id }
      });
    } else if (handler.schema) {
      const parsed = handler.schema.safeParse(params);
      if (!parsed.success) {
        issues.push({
          severity: "error",
          code: "INVALID_CONSTRAINT_PARAMS",
          message: `Invalid params for "${id}": ${parsed.error.issues.map((x: any) => x.message).join("; ")}`,
          path: `constraints[${i}]`,
          meta: { id, params }
        });
      }
    }

    const key = `${id}::${stableJson(params)}`;
    if (seen.has(key)) {
      issues.push({
        severity: "warn",
        code: "DUPLICATE_CONSTRAINT",
        message: `Duplicate constraint "${id}" with identical params.`,
        path: `constraints[${i}]`,
        meta: { id, params }
      });
    }
    seen.add(key);
  }

  // Context rules: add/remove conflicts + param validation on added constraints
  for (let ri = 0; ri < policy.contextRules.length; ri++) {
    const r = policy.contextRules[ri];
    const add = r.adjust.constraintsAdd ?? [];
    const remove = new Set(r.adjust.constraintsRemove ?? []);

    // conflict: adding and removing same id in same rule
    for (const a of add) {
      const id = specId(a);
      if (remove.has(id)) {
        issues.push({
          severity: "warn",
          code: "CONTEXT_CONSTRAINT_CONFLICT",
          message: `Context rule adds and removes "${id}" in the same adjustment. Remove one side.`,
          path: `contextRules[${ri}].adjust`,
          meta: { context: r.context, id }
        });
      }

      // validate added constraint params too
      const handler = deps.registry.getHandler(id);
      if (!handler) {
        issues.push({
          severity: "error",
          code: "UNKNOWN_CONSTRAINT",
          message: `Unknown constraint "${id}" added in context "${r.context}" (will fail closed).`,
          path: `contextRules[${ri}].adjust.constraintsAdd`,
          meta: { context: r.context, id }
        });
      } else if (handler.schema) {
        const parsed = handler.schema.safeParse(specParams(a));
        if (!parsed.success) {
          issues.push({
            severity: "error",
            code: "INVALID_CONSTRAINT_PARAMS",
            message: `Invalid params for "${id}" in context "${r.context}": ${parsed.error.issues
              .map((x: any) => x.message)
              .join("; ")}`,
            path: `contextRules[${ri}].adjust.constraintsAdd`,
            meta: { context: r.context, id, params: specParams(a) }
          });
        }
      }
    }

    // threshold sanity in context
    if (r.adjust.uncertaintyThreshold !== undefined) {
      const t = r.adjust.uncertaintyThreshold;
      if (t < 0 || t > 1) {
        issues.push({
          severity: "error",
          code: "THRESHOLD_OUT_OF_RANGE",
          message: `Context "${r.context}" sets uncertaintyThreshold outside [0,1]: ${t}`,
          path: `contextRules[${ri}].adjust.uncertaintyThreshold`
        });
      }
    }
  }

  const ok = !issues.some(i => i.severity === "error");
  return { ok, issues };
}
