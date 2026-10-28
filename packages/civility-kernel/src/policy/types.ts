// Types for the Civility Kernel preference-governed agent system

export type WeightKey = string;
export type ConstraintId = string;

export type ConstraintSpec =
  | ConstraintId
  | {
      id: ConstraintId;
      params?: Record<string, unknown>;
    };

export interface PreferencePolicy {
  version: string;
  weights: Record<WeightKey, number>;
  constraints: ConstraintSpec[];
  contextRules: Array<{
    context: string;
    when?: {
      minStake?: number;
      maxUncertainty?: number;
      tagsAny?: string[];
    };
    adjust: {
      weights?: Record<WeightKey, number>;
      constraintsAdd?: ConstraintSpec[];
      constraintsRemove?: ConstraintId[];
      uncertaintyThreshold?: number;
      calibration?: Partial<PreferencePolicy["calibration"]>;
    };
  }>;
  uncertaintyThreshold: number;
  memory: Record<string, unknown>;
  calibration: {
    riskTolerance: number;
    verbosity: number;
    initiative: number;
  };
}

export interface Plan {
  id: string;
  summary: string;
  steps: Array<{ kind: string; detail: string }>;
  meta: {
    estimatedCost?: number;
    estimatedTimeSec?: number;
    reversibility?: 0 | 1;
    stake?: number;
    uncertainty?: number;
    tags?: string[];
  };
}

export interface PlanEval {
  planId: string;
  passesConstraints: boolean;
  violatedConstraints: Array<ConstraintSpec & { reason?: string }>;
  scores: Record<WeightKey, number>;
  /**
   * Weighted utility of a plan that passes its constraints; `null` for a plan that fails one. (Before the move into
   * Cognate a failed plan carried `-Infinity`, which `JSON.stringify` writes as `null` and RFC 8785 can't represent,
   * so a trace didn't survive a JSON round-trip unchanged.)
   */
  utility: number | null;
}

export interface AppliedContextRule {
  context: string;
  adjustments: string[];
}

export interface DecisionTrace {
  decisionId: string;
  context: string;
  effectivePolicy: {
    weights: Record<WeightKey, number>;
    constraints: ConstraintSpec[];
    uncertaintyThreshold: number;
    calibration: PreferencePolicy["calibration"];
  };
  appliedContextRules: AppliedContextRule[];
  candidates: Array<{
    plan: Pick<Plan, "id" | "summary" | "meta">;
    eval: PlanEval;
  }>;
  chosenPlanId?: string;
  outcome: "EXECUTE" | "ASK_USER" | "NO_VALID_PLAN";
  rationale: string[];
  timestamp: string;
}
