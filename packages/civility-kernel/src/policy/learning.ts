import { PreferencePolicy } from "./types.js";

export interface FeedbackEvent {
  type: "CHOOSE_PLAN" | "UNDO" | "THUMBS_UP" | "THUMBS_DOWN" | "CONSTRAINT_RELAXED" | "PLAN_EDITED" | "TIMEOUT" | "ABORT";
  weightKey?: string;
  constraintId?: string;
  editedPlanId?: string;
  timestamp: string;
}

export interface PolicyUpdateProposal {
  reason: string;
  patch: Partial<PreferencePolicy>;
  needsHumanReview?: boolean;
}

export function proposePolicyUpdates(
  policy: PreferencePolicy,
  events: FeedbackEvent[]
): PolicyUpdateProposal[] {
  const proposals: PolicyUpdateProposal[] = [];
  const downs = events.filter(e => e.type === "THUMBS_DOWN").length;
  const undos = events.filter(e => e.type === "UNDO").length;
  const planEdits = events.filter(e => e.type === "PLAN_EDITED").length;
  if (undos + planEdits >= 3) {
    proposals.push({
      reason: "Multiple undo/plan-edit events suggest actions are too proactive.",
      patch: { calibration: { ...policy.calibration, initiative: Math.max(0, policy.calibration.initiative - 0.1) } }
    });
  }
  const verbosityDown = events.filter(e => e.type === "THUMBS_DOWN" && e.weightKey === "concise").length;
  if (verbosityDown >= 2) {
    proposals.push({
      reason: "Feedback suggests responses are too verbose.",
      patch: { calibration: { ...policy.calibration, verbosity: Math.max(0, policy.calibration.verbosity - 0.1) } }
    });
  }

  // CONSTRAINT_RELAXED: if 2+ events relax the same constraintId, propose removing it
  const relaxCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type === "CONSTRAINT_RELAXED" && e.constraintId) {
      relaxCounts.set(e.constraintId, (relaxCounts.get(e.constraintId) ?? 0) + 1);
    }
  }
  for (const [cid, count] of relaxCounts) {
    if (count >= 2) {
      proposals.push({
        reason: `Constraint "${cid}" was relaxed ${count} times; consider removing it.`,
        patch: {
          constraints: policy.constraints.filter(c =>
            typeof c === "string" ? c !== cid : c.id !== cid
          )
        },
        needsHumanReview: true
      });
    }
  }

  // TIMEOUT / ABORT: if 3+ combined, propose reducing initiative
  const timeoutAborts = events.filter(e => e.type === "TIMEOUT" || e.type === "ABORT").length;
  if (timeoutAborts >= 3) {
    proposals.push({
      reason: "Multiple timeout/abort events suggest the agent is overreaching.",
      patch: { calibration: { ...policy.calibration, initiative: Math.max(0, policy.calibration.initiative - 0.1) } }
    });
  }

  if (downs >= 5 && proposals.length === 0) {
    proposals.push({
      reason: "Repeated negative feedback; consider requesting user clarification of preferences.",
      patch: {}
    });
  }
  return proposals;
}

export function applyPolicyProposal(
  policy: PreferencePolicy,
  proposal: PolicyUpdateProposal
): PreferencePolicy {
  const result: PreferencePolicy = JSON.parse(JSON.stringify(policy));
  const patch = proposal.patch;

  if (patch.version !== undefined) result.version = patch.version;
  if (patch.uncertaintyThreshold !== undefined) result.uncertaintyThreshold = patch.uncertaintyThreshold;
  if (patch.constraints !== undefined) result.constraints = patch.constraints;
  if (patch.contextRules !== undefined) result.contextRules = patch.contextRules;
  if (patch.memory !== undefined) result.memory = { ...result.memory, ...patch.memory };

  if (patch.weights !== undefined) {
    result.weights = { ...result.weights, ...patch.weights };
  }

  if (patch.calibration !== undefined) {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    result.calibration = {
      riskTolerance: clamp(patch.calibration.riskTolerance ?? result.calibration.riskTolerance),
      verbosity: clamp(patch.calibration.verbosity ?? result.calibration.verbosity),
      initiative: clamp(patch.calibration.initiative ?? result.calibration.initiative),
    };
  }

  return result;
}
