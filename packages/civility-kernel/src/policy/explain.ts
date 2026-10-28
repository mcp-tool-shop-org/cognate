import { PreferencePolicy, ConstraintSpec } from "./types.js";
import { ConstraintRegistry } from "./constraints.js";

export interface ExplainOptions {
  format?: "text" | "markdown";
  includeWeights?: boolean;
  includeCalibration?: boolean;
  includeMemoryKeys?: boolean;
}

export interface PolicyExplanation {
  summary: string;
  lines: string[];
  warnings: string[];
}

function fmt(spec: ConstraintSpec): string {
  if (typeof spec === "string") return spec;
  const params = spec.params && Object.keys(spec.params).length
    ? ` ${JSON.stringify(spec.params)}`
    : "";
  return `${spec.id}${params}`;
}

function normalizeWeights(weights: Record<string, number>) {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, v]) => s + Math.max(0, v), 0);
  return entries.map(([k, v]) => {
    const pct = sum > 0 ? (Math.max(0, v) / sum) * 100 : 0;
    return { key: k, value: v, pct };
  });
}

export function explainPolicy(
  policy: PreferencePolicy,
  registry: ConstraintRegistry,
  opts: ExplainOptions = {}
): PolicyExplanation {
  const format = opts.format ?? "text";
  const includeWeights = opts.includeWeights ?? true;
  const includeCalibration = opts.includeCalibration ?? true;

  const lines: string[] = [];
  const warnings: string[] = [];

  const bullet = (s: string) => (format === "markdown" ? `- ${s}` : `• ${s}`);
  const header = (s: string) => (format === "markdown" ? `## ${s}` : s.toUpperCase());

  lines.push(header("Policy summary"));
  lines.push(
    bullet(
      `Uncertainty threshold: ${policy.uncertaintyThreshold.toFixed(2)} (above this, the agent should ask / offer options)`
    )
  );

  if (includeWeights) {
    lines.push("");
    lines.push(header("Tradeoffs (weights)"));
    for (const w of normalizeWeights(policy.weights)) {
      lines.push(bullet(`${w.key}: ${w.pct.toFixed(0)}%`));
    }
  }

  if (includeCalibration) {
    lines.push("");
    lines.push(header("Behavior calibration"));
    lines.push(bullet(`Risk tolerance: ${policy.calibration.riskTolerance.toFixed(2)}`));
    lines.push(bullet(`Verbosity: ${policy.calibration.verbosity.toFixed(2)}`));
    lines.push(bullet(`Initiative: ${policy.calibration.initiative.toFixed(2)}`));
  }

  lines.push("");
  lines.push(header("Hard constraints (non-negotiables)"));

  // Validate constraints using registry knowledge.
  for (const c of policy.constraints) {
    const spec = typeof c === "string" ? { id: c, params: {} } : { id: c.id, params: c.params ?? {} };

    const handler = registry.getHandler?.(spec.id);
    if (!handler) {
      warnings.push(`Unknown constraint (will fail closed): ${fmt(c)}`);
      lines.push(bullet(`${fmt(c)} — ⚠ unknown (fails closed)`));
      continue;
    }

    if (handler.schema) {
      const parsed = handler.schema.safeParse(spec.params ?? {});
      if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join("; ");
        warnings.push(`Invalid params for ${spec.id}: ${msg}`);
        lines.push(bullet(`${fmt(c)} — ❌ invalid params: ${msg}`));
        continue;
      }
    }

    lines.push(bullet(fmt(c)));
  }

  if (policy.contextRules.length) {
    lines.push("");
    lines.push(header("Context rules"));
    for (const r of policy.contextRules) {
      lines.push(bullet(`Context: ${r.context}`));

      if (r.when) {
        const parts: string[] = [];
        if (r.when.minStake !== undefined) parts.push(`minStake ≥ ${r.when.minStake}`);
        if (r.when.maxUncertainty !== undefined) parts.push(`maxUncertainty ≤ ${r.when.maxUncertainty}`);
        if (r.when.tagsAny?.length) parts.push(`tagsAny: ${r.when.tagsAny.join(", ")}`);
        if (parts.length) lines.push(bullet(`When: ${parts.join(" | ")}`));
      }

      const adj = r.adjust;
      if (adj.weights) lines.push(bullet(`Adjust weights: ${JSON.stringify(adj.weights)}`));
      if (adj.uncertaintyThreshold !== undefined)
        lines.push(bullet(`Adjust uncertaintyThreshold: ${adj.uncertaintyThreshold}`));
      if (adj.constraintsAdd?.length)
        lines.push(bullet(`Add constraints: ${adj.constraintsAdd.map(fmt).join("; ")}`));
      if (adj.constraintsRemove?.length)
        lines.push(bullet(`Remove constraints by id: ${adj.constraintsRemove.join(", ")}`));
      if (adj.calibration) lines.push(bullet(`Adjust calibration: ${JSON.stringify(adj.calibration)}`));
    }
  }

  if (opts.includeMemoryKeys) {
    lines.push("");
    lines.push(header("Stored preferences (memory keys)"));
    for (const k of Object.keys(policy.memory)) lines.push(bullet(k));
  }

  const summary = `Policy v${policy.version}: ${policy.constraints.length} constraints, ${Object.keys(policy.weights).length} weights, ${policy.contextRules.length} context rules.`;

  return { summary, lines, warnings };
}
