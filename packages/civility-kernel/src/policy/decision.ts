import { randomUUID } from "node:crypto";
import { ConstraintRegistry } from "./constraints.js";
import { compileEffectivePolicy } from "./context.js";
import { ScorerRegistry } from "./scoring.js";
import { DecisionTrace, Plan, PlanEval, PreferencePolicy } from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Per-call inputs that make a decision reproducible. With both supplied, the same policy, context and plans give a
 * byte-identical trace; omitted, a random UUID and the current time are used, as before.
 */
export interface DecideOptions {
  decisionId?: string;
  timestamp?: string;
}

export interface DecisionEngineOptions {
  onDecision?: (trace: DecisionTrace) => void | Promise<void>;
}

export class DecisionEngine {
  private onDecision?: (trace: DecisionTrace) => void | Promise<void>;

  constructor(
    private constraints: ConstraintRegistry,
    private scorers: ScorerRegistry,
    options?: DecisionEngineOptions
  ) {
    this.onDecision = options?.onDecision;
  }

  decide(
    basePolicy: PreferencePolicy,
    context: string,
    plans: Plan[],
    options?: DecideOptions
  ): { chosen?: Plan; trace: DecisionTrace } {
    const decisionId = options?.decisionId ?? randomUUID();

    if (plans.length === 0) {
      const { policy: effectivePolicy, appliedContextRules, warnings } = compileEffectivePolicy(basePolicy, context, plans);
      const rationale = ["No candidate plans were provided."];
      if (warnings.length > 0) {
        rationale.push(...warnings);
      }
      const trace: DecisionTrace = {
        decisionId,
        context,
        effectivePolicy: {
          weights: effectivePolicy.weights,
          constraints: effectivePolicy.constraints,
          uncertaintyThreshold: effectivePolicy.uncertaintyThreshold,
          calibration: effectivePolicy.calibration,
        },
        appliedContextRules,
        candidates: [],
        chosenPlanId: undefined,
        outcome: "NO_VALID_PLAN",
        rationale,
        timestamp: options?.timestamp ?? nowIso(),
      };
      if (this.onDecision) { void this.onDecision(trace); }
      return { chosen: undefined, trace };
    }

    const { policy: effectivePolicy, appliedContextRules, warnings: contextWarnings } = compileEffectivePolicy(basePolicy, context, plans);
    let scorerWarnings: string[] = [];
    const evals: PlanEval[] = plans.map((p) => {
      const results = this.constraints.evaluate(effectivePolicy.constraints, p, effectivePolicy);
      const violated = results.filter((r: any) => !r.ok).map((r: any) => ({
        id: r.id,
        params: r.params,
        reason: r.reason
      }));
      const passes = violated.length === 0;
      let scores: Record<string, number> = {};
      if (passes) {
        scores = this.scorers.score(p, effectivePolicy);
        for (const k of Object.keys(effectivePolicy.weights)) {
          if (!(k in scores)) {
            scorerWarnings.push(`Weight '${k}' had no scorer registered; treated as 0.`);
          }
        }
      }
      const utility = passes
        ? Object.entries(effectivePolicy.weights).reduce((sum, [k, w]) => sum + w * (scores[k] ?? 0), 0)
        : null;
      return {
        planId: p.id,
        passesConstraints: passes,
        violatedConstraints: violated,
        scores,
        utility,
      };
    });
    const survivors = plans
      .map((p, i) => ({ plan: p, eval: evals[i] }))
      .filter(x => x.eval.passesConstraints);

    let chosen: Plan | undefined;
    let outcome: DecisionTrace["outcome"] = "NO_VALID_PLAN";
    const rationale: string[] = [];
    if (survivors.length === 0) {
      outcome = "NO_VALID_PLAN";
      // Summarize constraint violations across all candidates
      const violationCounts: Record<string, number> = {};
      for (const e of evals) {
        for (const v of e.violatedConstraints) {
          const id = typeof v === "string" ? v : v.id;
          violationCounts[id] = (violationCounts[id] ?? 0) + 1;
        }
      }
      const topViolations = Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => `${id} (${count} plan${count > 1 ? "s" : ""})`)
        .join(", ");
      rationale.push(
        `All candidate plans violated hard constraints. Top violations: ${topViolations}.`
      );
      rationale.push("Agent must ask user to relax constraints or propose new options.");
    } else {
      // Sort by utility to find top candidate, then check uncertainty on chosen plan only
      // Survivors passed their constraints, so their utility is a number.
      survivors.sort((a, b) => (b.eval.utility as number) - (a.eval.utility as number));
      const top = survivors[0];
      const topUnc = top.plan.meta.uncertainty ?? 0;
      const shouldAsk = topUnc > effectivePolicy.uncertaintyThreshold;
      if (shouldAsk) {
        outcome = "ASK_USER";
        rationale.push(
          `Top plan "${top.plan.id}" has uncertainty (${topUnc.toFixed(2)}) exceeding threshold (${effectivePolicy.uncertaintyThreshold.toFixed(2)}).`
        );
        rationale.push("Agent should present top surviving options and ask for preference/confirmation.");
      } else {
        chosen = top.plan;
        outcome = "EXECUTE";
        rationale.push("Selected highest-utility plan among constraint-passing candidates.");
      }
    }
    if (scorerWarnings.length > 0) {
      rationale.push(...scorerWarnings);
    }
    if (contextWarnings.length > 0) {
      rationale.push(...contextWarnings);
    }
    const trace: DecisionTrace = {
      decisionId,
      context,
      effectivePolicy: {
        weights: effectivePolicy.weights,
        constraints: effectivePolicy.constraints,
        uncertaintyThreshold: effectivePolicy.uncertaintyThreshold,
        calibration: effectivePolicy.calibration,
      },
      appliedContextRules,
      candidates: plans.map((p, i) => ({
        plan: { id: p.id, summary: p.summary, meta: p.meta },
        eval: evals[i],
      })),
      chosenPlanId: chosen?.id,
      outcome,
      rationale,
      timestamp: options?.timestamp ?? nowIso(),
    };
    if (this.onDecision) { void this.onDecision(trace); }
    return { chosen, trace };
  }

  async decideAsync(
    basePolicy: PreferencePolicy,
    context: string,
    plans: Plan[],
    options?: DecideOptions
  ): Promise<{ chosen?: Plan; trace: DecisionTrace }> {
    const decisionId = options?.decisionId ?? randomUUID();

    if (plans.length === 0) {
      const { policy: effectivePolicy, appliedContextRules, warnings } = compileEffectivePolicy(basePolicy, context, plans);
      const rationale = ["No candidate plans were provided."];
      if (warnings.length > 0) {
        rationale.push(...warnings);
      }
      const trace: DecisionTrace = {
        decisionId,
        context,
        effectivePolicy: {
          weights: effectivePolicy.weights,
          constraints: effectivePolicy.constraints,
          uncertaintyThreshold: effectivePolicy.uncertaintyThreshold,
          calibration: effectivePolicy.calibration,
        },
        appliedContextRules,
        candidates: [],
        chosenPlanId: undefined,
        outcome: "NO_VALID_PLAN",
        rationale,
        timestamp: options?.timestamp ?? nowIso(),
      };
      if (this.onDecision) { await this.onDecision(trace); }
      return { chosen: undefined, trace };
    }

    const { policy: effectivePolicy, appliedContextRules, warnings: contextWarnings } = compileEffectivePolicy(basePolicy, context, plans);
    let scorerWarnings: string[] = [];
    const evals: PlanEval[] = await Promise.all(plans.map(async (p) => {
      const results = await this.constraints.evaluateAsync(effectivePolicy.constraints, p, effectivePolicy);
      const violated = results.filter((r: any) => !r.ok).map((r: any) => ({
        id: r.id,
        params: r.params,
        reason: r.reason
      }));
      const passes = violated.length === 0;
      let scores: Record<string, number> = {};
      if (passes) {
        scores = this.scorers.score(p, effectivePolicy);
        for (const k of Object.keys(effectivePolicy.weights)) {
          if (!(k in scores)) {
            scorerWarnings.push(`Weight '${k}' had no scorer registered; treated as 0.`);
          }
        }
      }
      const utility = passes
        ? Object.entries(effectivePolicy.weights).reduce((sum, [k, w]) => sum + w * (scores[k] ?? 0), 0)
        : null;
      return {
        planId: p.id,
        passesConstraints: passes,
        violatedConstraints: violated,
        scores,
        utility,
      };
    }));
    const survivors = plans
      .map((p, i) => ({ plan: p, eval: evals[i] }))
      .filter(x => x.eval.passesConstraints);

    let chosen: Plan | undefined;
    let outcome: DecisionTrace["outcome"] = "NO_VALID_PLAN";
    const rationale: string[] = [];
    if (survivors.length === 0) {
      outcome = "NO_VALID_PLAN";
      const violationCounts: Record<string, number> = {};
      for (const e of evals) {
        for (const v of e.violatedConstraints) {
          const id = typeof v === "string" ? v : v.id;
          violationCounts[id] = (violationCounts[id] ?? 0) + 1;
        }
      }
      const topViolations = Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => `${id} (${count} plan${count > 1 ? "s" : ""})`)
        .join(", ");
      rationale.push(
        `All candidate plans violated hard constraints. Top violations: ${topViolations}.`
      );
      rationale.push("Agent must ask user to relax constraints or propose new options.");
    } else {
      // Survivors passed their constraints, so their utility is a number.
      survivors.sort((a, b) => (b.eval.utility as number) - (a.eval.utility as number));
      const top = survivors[0];
      const topUnc = top.plan.meta.uncertainty ?? 0;
      const shouldAsk = topUnc > effectivePolicy.uncertaintyThreshold;
      if (shouldAsk) {
        outcome = "ASK_USER";
        rationale.push(
          `Top plan "${top.plan.id}" has uncertainty (${topUnc.toFixed(2)}) exceeding threshold (${effectivePolicy.uncertaintyThreshold.toFixed(2)}).`
        );
        rationale.push("Agent should present top surviving options and ask for preference/confirmation.");
      } else {
        chosen = top.plan;
        outcome = "EXECUTE";
        rationale.push("Selected highest-utility plan among constraint-passing candidates.");
      }
    }
    if (scorerWarnings.length > 0) {
      rationale.push(...scorerWarnings);
    }
    if (contextWarnings.length > 0) {
      rationale.push(...contextWarnings);
    }
    const trace: DecisionTrace = {
      decisionId,
      context,
      effectivePolicy: {
        weights: effectivePolicy.weights,
        constraints: effectivePolicy.constraints,
        uncertaintyThreshold: effectivePolicy.uncertaintyThreshold,
        calibration: effectivePolicy.calibration,
      },
      appliedContextRules,
      candidates: plans.map((p, i) => ({
        plan: { id: p.id, summary: p.summary, meta: p.meta },
        eval: evals[i],
      })),
      chosenPlanId: chosen?.id,
      outcome,
      rationale,
      timestamp: options?.timestamp ?? nowIso(),
    };
    if (this.onDecision) { await this.onDecision(trace); }
    return { chosen, trace };
  }
}
