import { canonicalize } from "json-canonicalize";
import { PreferencePolicy, Plan, ConstraintSpec, AppliedContextRule } from "./types.js";

// Glob context matching: `*` matches any single segment (between colons)
const regexCache = new Map<string, RegExp>();

export function matchesContext(pattern: string, context: string): boolean {
  if (pattern === context) return true;
  if (!pattern.includes("*")) return false;

  let regex = regexCache.get(pattern);
  if (!regex) {
    // Escape special regex chars except *, then replace * with [^:]*
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^:]*");
    regex = new RegExp("^" + escaped + "$");
    regexCache.set(pattern, regex);
  }
  return regex.test(context);
}

function contextSpecificity(pattern: string): number {
  // More literal (non-wildcard) characters = more specific
  return pattern.replace(/\*/g, "").length;
}

function constraintKey(spec: ConstraintSpec): string {
  if (typeof spec === "string") return spec;
  const params = spec.params && Object.keys(spec.params).length ? JSON.stringify(spec.params) : "";
  return `${spec.id}${params ? ":" + params : ""}`;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const sum = entries.reduce((a, [, v]) => a + Math.max(0, v), 0);
  if (sum <= 0) return Object.fromEntries(entries.map(([k]) => [k, 0]));
  return Object.fromEntries(entries.map(([k, v]) => [k, Math.max(0, v) / sum]));
}

export interface CompileResult {
  policy: PreferencePolicy;
  appliedContextRules: AppliedContextRule[];
  warnings: string[];
}

/**
 * A deterministic key for everything `compileEffectivePolicy` reads: the whole policy (in RFC 8785 canonical form),
 * the context, and the plan fields its `when` guards look at. Callers that memoize compiles can key on it.
 *
 * Before the move into Cognate this keyed on the policy's version string only, so two policies with the same version
 * but different weights or constraints shared one key.
 */
export function computeCacheKey(base: PreferencePolicy, context: string, plans: Plan[]): string {
  const planMeta = plans.map(p => ({
    stake: p.meta.stake ?? 0,
    uncertainty: p.meta.uncertainty ?? 0,
    tags: (p.meta.tags ?? []).slice().sort(),
  }));
  return canonicalize({ policy: base, ctx: context, pm: planMeta });
}

/**
 * Apply the context rules that match `context` to a copy of `base`. Pure: no module state, and every call returns a
 * fresh result, so one caller's mutation can't reach another's.
 */
export function compileEffectivePolicy(
  base: PreferencePolicy,
  context: string,
  plans: Plan[]
): CompileResult {
  let eff: PreferencePolicy = structuredClone(base);
  const appliedContextRules: AppliedContextRule[] = [];
  const warnings: string[] = [];

  // Track which fields each rule touches for last-writer-wins detection
  const fieldWriters: Record<string, string[]> = {};

  // Sort rules: exact matches first, then by specificity (most specific first)
  const matchingRules = base.contextRules
    .filter(rule => matchesContext(rule.context, context))
    .sort((a, b) => {
      const aExact = a.context === context ? 1 : 0;
      const bExact = b.context === context ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return contextSpecificity(b.context) - contextSpecificity(a.context);
    });

  for (const rule of matchingRules) {
    const when = rule.when;
    const applies = (() => {
      if (!when) return true;
      const maxStake = plans.length ? Math.max(...plans.map(p => p.meta.stake ?? 0)) : 0;
      const maxUnc = plans.length ? Math.max(...plans.map(p => p.meta.uncertainty ?? 0)) : 0;
      const anyTags = new Set(plans.flatMap(p => p.meta.tags ?? []));
      if (when.minStake !== undefined && maxStake < when.minStake) return false;
      if (when.maxUncertainty !== undefined && maxUnc > when.maxUncertainty) return false;
      if (when.tagsAny && !when.tagsAny.some(t => anyTags.has(t))) return false;
      return true;
    })();
    if (!applies) continue;

    const adjustments: string[] = [];

    if (rule.adjust.weights) {
      eff.weights = { ...eff.weights, ...rule.adjust.weights };
      const desc = Object.entries(rule.adjust.weights).map(([k, v]) => `${k}: ${v}`).join(", ");
      adjustments.push(`adjusted weights: {${desc}}`);
      (fieldWriters["weights"] ??= []).push(rule.context);
    }
    if (rule.adjust.constraintsAdd) {
      const seen = new Set(eff.constraints.map(constraintKey));
      const toAdd = rule.adjust.constraintsAdd.filter(c => !seen.has(constraintKey(c)));
      eff.constraints = [...eff.constraints, ...toAdd];
      for (const c of toAdd) {
        adjustments.push(`added constraint: ${constraintKey(c)}`);
      }
    }
    if (rule.adjust.constraintsRemove) {
      const remove = new Set(rule.adjust.constraintsRemove);
      eff.constraints = eff.constraints.filter(c => {
        if (typeof c === "string") return !remove.has(c);
        return !remove.has(c.id);
      });
      for (const id of rule.adjust.constraintsRemove) {
        adjustments.push(`removed constraint: ${id}`);
      }
    }
    if (rule.adjust.uncertaintyThreshold !== undefined) {
      eff.uncertaintyThreshold = clamp01(rule.adjust.uncertaintyThreshold);
      adjustments.push(`set uncertaintyThreshold to ${rule.adjust.uncertaintyThreshold}`);
      (fieldWriters["uncertaintyThreshold"] ??= []).push(rule.context);
    }
    if (rule.adjust.calibration) {
      eff.calibration = { ...eff.calibration, ...rule.adjust.calibration };
      const desc = Object.entries(rule.adjust.calibration).map(([k, v]) => `${k}: ${v}`).join(", ");
      adjustments.push(`adjusted calibration: {${desc}}`);
      (fieldWriters["calibration"] ??= []).push(rule.context);
    }

    if (adjustments.length > 0) {
      appliedContextRules.push({ context: rule.context, adjustments });
    }
  }

  // Detect last-writer-wins conflicts
  for (const [field, writers] of Object.entries(fieldWriters)) {
    if (writers.length > 1) {
      warnings.push(
        `Last-writer-wins: ${writers.length} context rules (${writers.map(w => `"${w}"`).join(", ")}) adjusted '${field}'; last value wins.`
      );
    }
  }

  eff.weights = normalizeWeights(eff.weights);
  return { policy: eff, appliedContextRules, warnings };
}
