import { ConstraintRegistry, registerDefaultConstraints } from "./constraints.js";
import { ScorerRegistry, registerDefaultScorers } from "./scoring.js";
import { DecisionEngine, DecideOptions } from "./decision.js";
import { lintPolicy, LintReport } from "./lint.js";
import { explainPolicy, ExplainOptions } from "./explain.js";
import { diffPolicy, PolicyDiff } from "./diff.js";
import { proposePolicyUpdates, PolicyUpdateProposal, FeedbackEvent } from "./learning.js";
import type { PreferencePolicy, Plan, DecisionTrace } from "./types.js";

export interface KernelConfig {
  policy: PreferencePolicy;
  constraints?: (reg: ConstraintRegistry) => void;
  scorers?: (reg: ScorerRegistry) => void;
  onDecision?: (trace: DecisionTrace) => void | Promise<void>;
}

export interface Kernel {
  decide(context: string, plans: Plan[], options?: DecideOptions): DecisionTrace;
  decideAsync(context: string, plans: Plan[], options?: DecideOptions): Promise<DecisionTrace>;
  lint(): LintReport;
  explain(options?: ExplainOptions): string[];
  diff(other: PreferencePolicy): PolicyDiff;
  proposePolicyUpdates(events: FeedbackEvent[]): PolicyUpdateProposal[];
  updatePolicy(policy: PreferencePolicy): void;
  getPolicy(): PreferencePolicy;
}

export function createKernel(config: KernelConfig): Kernel {
  let policy = config.policy;

  const constraintReg = new ConstraintRegistry();
  registerDefaultConstraints(constraintReg);
  if (config.constraints) {
    config.constraints(constraintReg);
  }

  const scorerReg = new ScorerRegistry();
  registerDefaultScorers(scorerReg);
  if (config.scorers) {
    config.scorers(scorerReg);
  }

  const engine = new DecisionEngine(constraintReg, scorerReg, {
    onDecision: config.onDecision,
  });

  return {
    decide(context: string, plans: Plan[], options?: DecideOptions): DecisionTrace {
      const { trace } = engine.decide(policy, context, plans, options);
      return trace;
    },

    async decideAsync(context: string, plans: Plan[], options?: DecideOptions): Promise<DecisionTrace> {
      const { trace } = await engine.decideAsync(policy, context, plans, options);
      return trace;
    },

    lint(): LintReport {
      return lintPolicy(policy, { registry: constraintReg, scorers: scorerReg });
    },

    explain(options?: ExplainOptions): string[] {
      const result = explainPolicy(policy, constraintReg, options);
      return result.lines;
    },

    diff(other: PreferencePolicy): PolicyDiff {
      return diffPolicy(policy, other, constraintReg);
    },

    proposePolicyUpdates(events: FeedbackEvent[]): PolicyUpdateProposal[] {
      return proposePolicyUpdates(policy, events);
    },

    updatePolicy(newPolicy: PreferencePolicy): void {
      policy = newPolicy;
    },

    getPolicy(): PreferencePolicy {
      return policy;
    },
  };
}
