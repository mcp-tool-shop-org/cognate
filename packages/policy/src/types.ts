/**
 * Policy evaluation types — pure, serializable, zero side effects.
 */

import type {
  ActorId,
  Capability,
  HashId,
  Policy,
  PolicyAction,
  PolicyCondition,
  PolicyRule,
  PolicyRuleType,
  PolicyTarget,
  TenantId,
} from "@cognate/types";

/** The context against which a policy is evaluated. Immutable. */
export interface EvaluationContext {
  readonly tenantId: TenantId;
  readonly actorId: ActorId;
  readonly modelVersionId: HashId | null;
  readonly agentId: ActorId | null;
  readonly timestamp: string; // ISO 8601

  /** The prompt text (decrypted, only for evaluation — not persisted). */
  readonly promptText: string | null;

  /** The output text (decrypted, only for evaluation — not persisted). */
  readonly outputText: string | null;

  /** Metadata available at evaluation time. */
  readonly metadata: {
    readonly tokensIn: number | null;
    readonly tokensOut: number | null;
    readonly latencyMs: number | null;
    readonly confidence: number | null;
    readonly finishReason: string | null;
    readonly tags: readonly string[];
  };

  /** Current capabilities of the acting agent (if any). */
  readonly agentCapabilities: readonly Capability[];

  /** Evaluation counters for rate-limit checks. */
  readonly counters: {
    readonly callsInWindow: number;
    readonly windowSeconds: number;
    readonly spendInWindow: number;
    readonly spendCurrency: string;
  };
}

/** Result of evaluating a single rule against a context. */
export interface RuleResult {
  readonly ruleId: HashId;
  readonly ruleType: PolicyRuleType;
  readonly matched: boolean;
  readonly severity: "block" | "flag" | "log";
  readonly action: PolicyAction;
  readonly reason: string;
}

/** Aggregate result of evaluating a full policy. */
export interface PolicyResult {
  readonly policyId: HashId;
  readonly policyVersion: number;
  readonly evaluatedAt: string; // ISO 8601
  readonly overall: "allow" | "deny" | "require-human-review" | "quarantine";
  readonly ruleResults: readonly RuleResult[];
  readonly matchedRules: readonly RuleResult[];
  readonly blockingRules: readonly RuleResult[];
}
