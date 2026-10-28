import type { PreferencePolicy, ConstraintSpec } from "./types.js";
import type { ConstraintRegistry } from "./constraints.js";

function stableJson(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(stableJson).join(",")}]`;
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableJson(obj[k])).join(",")}}`;
}

function canonicalizeSpec(spec: ConstraintSpec, registry: ConstraintRegistry): ConstraintSpec {
  const id = typeof spec === "string" ? spec : spec.id;
  const params = typeof spec === "string" ? {} : (spec.params ?? {});
  
  const handler = registry.getHandler(id);
  if (handler?.schema) {
    const parsed = handler.schema.safeParse(params);
    if (parsed.success) {
      // Use parsed data to fill in defaults
      const data = parsed.data as Record<string, unknown>;
      return Object.keys(data).length > 0 ? { id, params: data } : id;
    }
  }
  
  return Object.keys(params).length > 0 ? { id, params } : id;
}

function sortSpecs(specs: ConstraintSpec[]): ConstraintSpec[] {
  return [...specs].sort((a, b) => {
    const aId = typeof a === "string" ? a : a.id;
    const bId = typeof b === "string" ? b : b.id;
    if (aId !== bId) return aId.localeCompare(bId);
    return stableJson(a).localeCompare(stableJson(b));
  });
}

export function canonicalizePolicy(policy: PreferencePolicy, registry: ConstraintRegistry): PreferencePolicy {
  const out: PreferencePolicy = {
    ...policy,
    weights: Object.fromEntries(Object.entries(policy.weights).sort(([a], [b]) => a.localeCompare(b))),
    constraints: sortSpecs(policy.constraints.map(c => canonicalizeSpec(c, registry))),
    contextRules: policy.contextRules.map(r => ({
      ...r,
      adjust: {
        ...r.adjust,
        constraintsAdd: r.adjust.constraintsAdd ? sortSpecs(r.adjust.constraintsAdd.map(c => canonicalizeSpec(c, registry))) : undefined,
        constraintsRemove: r.adjust.constraintsRemove ? [...r.adjust.constraintsRemove].sort() : undefined,
        weights: r.adjust.weights ? Object.fromEntries(Object.entries(r.adjust.weights).sort(([a], [b]) => a.localeCompare(b))) : undefined,
      }
    }))
  };
  return out;
}
