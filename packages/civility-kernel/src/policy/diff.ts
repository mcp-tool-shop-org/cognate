import type { PreferencePolicy, ConstraintSpec } from "./types.js";
import type { ConstraintRegistry } from "./constraints.js";

export interface PolicyDiffItem {
  kind:
    | "weight_changed"
    | "weight_added"
    | "weight_removed"
    | "constraint_added"
    | "constraint_removed"
    | "threshold_changed"
    | "calibration_changed"
    | "context_rule_added"
    | "context_rule_removed"
    | "context_rule_changed";
  message: string;
  path?: string;
  meta?: Record<string, unknown>;
}

export interface PolicyDiff {
  changed: boolean;
  items: PolicyDiffItem[];
}

function stableJson(obj: unknown): string {
  if (obj === null || obj === undefined || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableJson).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + sorted.map(k => JSON.stringify(k) + ":" + stableJson((obj as Record<string, unknown>)[k])).join(",") + "}";
}

function specKey(spec: ConstraintSpec): string {
  if (typeof spec === "string") return spec;
  const params = spec.params && Object.keys(spec.params).length ? JSON.stringify(spec.params) : "";
  return `${spec.id}${params ? ":" + params : ""}`;
}

function byKey<T>(arr: T[], keyFn: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) m.set(keyFn(x), x);
  return m;
}

function describeSpec(spec: ConstraintSpec, registry?: ConstraintRegistry): string {
  const id = typeof spec === "string" ? spec : spec.id;
  const params = typeof spec === "string" ? undefined : spec.params;
  const handler = registry?.getHandler(id);
  if (handler?.describe) {
    return handler.describe(params);
  }
  return specKey(spec);
}

export function diffPolicy(a: PreferencePolicy, b: PreferencePolicy, registry?: ConstraintRegistry): PolicyDiff {
  const items: PolicyDiffItem[] = [];

  // threshold
  if (a.uncertaintyThreshold !== b.uncertaintyThreshold) {
    items.push({
      kind: "threshold_changed",
      message: `Uncertainty threshold changed ${a.uncertaintyThreshold} → ${b.uncertaintyThreshold}`,
      path: "uncertaintyThreshold"
    });
  }

  // calibration
  for (const k of ["riskTolerance", "verbosity", "initiative"] as const) {
    if (a.calibration[k] !== b.calibration[k]) {
      items.push({
        kind: "calibration_changed",
        message: `Calibration "${k}" changed ${a.calibration[k]} → ${b.calibration[k]}`,
        path: `calibration.${k}`
      });
    }
  }

  // weights
  const aW = a.weights, bW = b.weights;
  for (const k of new Set([...Object.keys(aW), ...Object.keys(bW)])) {
    if (!(k in aW)) {
      items.push({ kind: "weight_added", message: `Weight "${k}" added (${bW[k]})`, path: `weights.${k}` });
    } else if (!(k in bW)) {
      items.push({ kind: "weight_removed", message: `Weight "${k}" removed (was ${aW[k]})`, path: `weights.${k}` });
    } else if (aW[k] !== bW[k]) {
      items.push({
        kind: "weight_changed",
        message: `Weight "${k}" changed ${aW[k]} → ${bW[k]}`,
        path: `weights.${k}`
      });
    }
  }

  // constraints (treat each spec instance as a set element keyed by id+params)
  const aC = new Map(a.constraints.map(c => [specKey(c), c]));
  const bC = new Map(b.constraints.map(c => [specKey(c), c]));
  for (const [k, spec] of bC) {
    if (!aC.has(k)) {
      items.push({ kind: "constraint_added", message: `Constraint added: ${describeSpec(spec, registry)}`, path: "constraints" });
    }
  }
  for (const [k, spec] of aC) {
    if (!bC.has(k)) {
      items.push({ kind: "constraint_removed", message: `Constraint removed: ${describeSpec(spec, registry)}`, path: "constraints" });
    }
  }

  // context rules (simple diff by index+context; later you can get fancy)
  const aR = byKey(a.contextRules, r => r.context);
  const bR = byKey(b.contextRules, r => r.context);

  for (const [ctx, r] of bR) {
    if (!aR.has(ctx)) {
      items.push({ kind: "context_rule_added", message: `Context rule added: ${ctx}`, path: "contextRules", meta: { context: ctx } });
      continue;
    }
    const prev = aR.get(ctx)!;
    const prevJson = stableJson(prev.adjust);
    const nextJson = stableJson(r.adjust);
    const prevWhen = stableJson(prev.when ?? {});
    const nextWhen = stableJson(r.when ?? {});
    if (prevJson !== nextJson || prevWhen !== nextWhen) {
      items.push({
        kind: "context_rule_changed",
        message: `Context rule changed: ${ctx}`,
        path: "contextRules",
        meta: { context: ctx, before: prev, after: r }
      });
    }
  }
  for (const [ctx] of aR) {
    if (!bR.has(ctx)) items.push({ kind: "context_rule_removed", message: `Context rule removed: ${ctx}`, path: "contextRules", meta: { context: ctx } });
  }

  return { changed: items.length > 0, items };
}
