/**
 * Cognate — AI Governance Domain Types
 */

export type HashId = string & { readonly __brand: "HashId" };
export type Timestamp = string & { readonly __brand: "Timestamp" };
export type TenantId = string & { readonly __brand: "TenantId" };
export type ActorId = string & { readonly __brand: "ActorId" };

export type ModelArchitecture =
  | "transformer" | "diffusion" | "mamba" | "rnn" | "cnn" | "hybrid" | "other";

export interface Model {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly description: string;
  readonly architecture: ModelArchitecture;
  readonly createdAt: Timestamp;
  readonly owner: ActorId;
  readonly currentVersion: HashId | null;
  readonly status: ModelStatus;
}

export type ModelStatus = "active" | "deprecated" | "retired";

export interface ModelVersion {
  readonly id: HashId;
  readonly modelId: HashId;
  readonly tenantId: TenantId;
  readonly versionNumber: number;
  readonly weightsHash: HashId;
  readonly configHash: HashId;
  readonly manifestHash: HashId;
  readonly datasetRefs: readonly DatasetRef[];
  readonly createdAt: Timestamp;
  readonly status: ModelVersionStatus;
}

export type ModelVersionStatus =
  | "registered" | "evaluated" | "approved" | "deployed" | "rejected" | "retired";

export interface DatasetRef {
  readonly name: string;
  readonly hash: HashId;
  readonly purpose: "training" | "validation" | "testing" | "fine-tuning";
  readonly consentVerified: boolean;
}

export interface Policy {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly version: number;
  readonly rules: readonly PolicyRule[];
  readonly createdAt: Timestamp;
  readonly approvedBy: ActorId | null;
  readonly status: PolicyStatus;
}

export type PolicyStatus = "draft" | "approved" | "active" | "superseded";

export interface PolicyRule {
  readonly id: HashId;
  readonly type: PolicyRuleType;
  readonly target: PolicyTarget;
  readonly condition: PolicyCondition;
  readonly action: PolicyAction;
  readonly severity: "block" | "flag" | "log";
}

export type PolicyRuleType =
  | "content-filter" | "capability-limit" | "rate-limit" | "guardrail" | "composite";

export type PolicyTarget =
  | { readonly kind: "model"; readonly modelId: HashId }
  | { readonly kind: "agent"; readonly agentId: ActorId }
  | { readonly kind: "tenant"; readonly tenantId: TenantId }
  | { readonly kind: "global" };

export type PolicyCondition =
  | { readonly kind: "regex"; readonly pattern: string }
  | { readonly kind: "keyword"; readonly words: readonly string[] }
  | { readonly kind: "threshold"; readonly metric: string; readonly operator: "lt" | "lte" | "gt" | "gte" | "eq"; readonly value: number }
  | { readonly kind: "composite-and"; readonly conditions: readonly PolicyCondition[] }
  | { readonly kind: "composite-or"; readonly conditions: readonly PolicyCondition[] };

export type PolicyAction = "allow" | "deny" | "require-human-review" | "quarantine";

export interface Agent {
  readonly id: ActorId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly owner: ActorId;
  readonly walletAddress: string | null;
  readonly publicKey: string | null;
  readonly capabilities: readonly Capability[];
  readonly createdAt: Timestamp;
  readonly status: AgentStatus;
}

export type AgentStatus = "active" | "suspended" | "revoked";

export interface Capability {
  readonly id: HashId;
  readonly kind: CapabilityKind;
  readonly scope: CapabilityScope;
  readonly constraints: readonly CapabilityConstraint[];
  readonly grantedAt: Timestamp;
  readonly grantedBy: ActorId;
  readonly expiresAt: Timestamp | null;
}

export type CapabilityKind =
  | "inference" | "spend" | "sign" | "access-data" | "delegate" | "deploy-model";

export type CapabilityScope =
  | { readonly kind: "model"; readonly modelId: HashId }
  | { readonly kind: "dataset"; readonly datasetHash: HashId }
  | { readonly kind: "financial"; readonly maxAmount: number; readonly currency: string }
  | { readonly kind: "unlimited" };

export type CapabilityConstraint =
  | { readonly kind: "rate-limit"; readonly maxCalls: number; readonly windowSeconds: number }
  | { readonly kind: "time-window"; readonly start: Timestamp; readonly end: Timestamp }
  | { readonly kind: "approval-required"; readonly approvers: readonly ActorId[] };

export interface CapabilityGrant {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly agentId: ActorId;
  readonly capability: Capability;
  readonly requestedBy: ActorId;
  readonly requestedAt: Timestamp;
  readonly status: GrantStatus;
  readonly approvedBy: ActorId | null;
  readonly approvedAt: Timestamp | null;
}

export type GrantStatus = "pending" | "approved" | "rejected" | "revoked";

export interface Prompt {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly sessionId: string;
  readonly modelVersionId: HashId;
  readonly policyVersion: number;
  readonly agentId: ActorId | null;
  readonly plaintextHash: HashId;
  readonly ciphertext: string;
  readonly metadata: PromptMetadata;
  readonly submittedAt: Timestamp;
}

export interface PromptMetadata {
  readonly tokensIn: number | null;
  readonly systemPromptHash: HashId | null;
  readonly temperature: number | null;
  readonly topP: number | null;
  readonly tags: readonly string[];
}

export interface Output {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly promptId: HashId;
  readonly modelVersionId: HashId;
  readonly plaintextHash: HashId;
  readonly ciphertext: string;
  readonly metadata: OutputMetadata;
  readonly generatedAt: Timestamp;
}

export interface OutputMetadata {
  readonly tokensOut: number | null;
  readonly latencyMs: number | null;
  readonly finishReason: "stop" | "length" | "content-filter" | "tool-call" | "error" | null;
  readonly confidence: number | null;
}

export interface Evaluation {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly modelVersionId: HashId;
  readonly evaluator: ActorId;
  readonly evaluatedAt: Timestamp;
  readonly metrics: readonly EvalMetric[];
  readonly overall: "pass" | "fail" | "conditional";
  readonly notes: string;
}

export interface EvalMetric {
  readonly name: string;
  readonly value: number;
  readonly threshold: number;
  readonly operator: "lt" | "lte" | "gt" | "gte" | "eq";
  readonly passed: boolean;
}

export interface DriftEvent {
  readonly id: HashId;
  readonly tenantId: TenantId;
  readonly kind: DriftKind;
  readonly targetId: HashId | ActorId;
  readonly detectedAt: Timestamp;
  readonly severity: "info" | "warning" | "critical";
  readonly description: string;
  readonly baselineWindow: { readonly start: Timestamp; readonly end: Timestamp };
  readonly currentWindow: { readonly start: Timestamp; readonly end: Timestamp };
}

export type DriftKind =
  | "output-distribution" | "policy-violation" | "agent-behavior"
  | "adversarial-prompt" | "capability-exceedance";
