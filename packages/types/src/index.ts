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
  /** RepoMesh repository this version deploys as. The HTTP server checks this pair. */
  readonly repo?: string;
  /** RepoMesh release name recorded with `repo`. */
  readonly release?: string;
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
  | "inference" | "spend" | "sign" | "access-data" | "delegate" | "deploy-model" | "verify-repomesh";

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


/**
 * Plaintext field names that name an account (HF repo IDs, GitHub owners,
 * emails, home paths) and are forbidden in records under the hashed-identifier rule.
 * Use the `*Sha256` fields instead (`ggufRepoSha256`, `hostedRepoSha256`,
 * `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`,
 * `emailSha256`, `homePathSha256`).
 */
export type ForbiddenPlaintextIdentifierKey =
  | "ggufRepo"
  | "gguf_repo"
  | "ggufSource"
  | "gguf_source"
  | "hostedRepo"
  | "hosted_repo"
  | "hfRepo"
  | "hf_repo"
  | "repo"
  | "githubOwner"
  | "github_owner"
  | "owner"
  | "repoOwner"
  | "repo_owner"
  | "hfOwner"
  | "hf_owner"
  | "githubUser"
  | "github_user"
  | "hfUser"
  | "hf_user"
  | "username"
  | "user_name"
  | "user"
  | "author"
  | "account"
  | "accountName"
  | "account_name"
  | "email"
  | "authorEmail"
  | "author_email"
  | "userEmail"
  | "user_email"
  | "homePath"
  | "home_path"
  | "handle"
  | "githubHandle"
  | "github_handle"
  | "hfHandle"
  | "hf_handle";

/**
 * Account balance field names forbidden in run records.
 * Records carry the run's own `cost` (`unitsSpent`, `rate`, `basis`), never
 * the account's start or end balance.
 */
export type ForbiddenAccountBalanceKey =
  | "balance"
  | "startBalance"
  | "endBalance"
  | "startBalanceBeforeLaunch"
  | "start_balance"
  | "end_balance"
  | "start_balance_before_launch"
  | "endBalanceAfterRun"
  | "startingBalance"
  | "starting_balance"
  | "endingBalance"
  | "ending_balance"
  | "remainingBalance"
  | "remaining_balance"
  | "initialBalance"
  | "initial_balance"
  | "finalBalance"
  | "final_balance"
  | "accountBalance"
  | "account_balance"
  | "colabBalance"
  | "colab_balance"
  | "unitBalance"
  | "creditBalance"
  | "walletBalance";

/**
 * Compile-time prohibition of plaintext account-naming fields and account balance fields.
 */
export type ForbidPlaintextAccountFields = {
  readonly [K in ForbiddenPlaintextIdentifierKey | ForbiddenAccountBalanceKey]?: never;
};

/**
 * Hashed account-naming identifiers stored as 64-character lowercase hex SHA-256 digests.
 */
export interface RunIdentifierHashes extends ForbidPlaintextAccountFields {
  readonly ggufRepoSha256?: HashId | null;
  readonly hostedRepoSha256?: HashId | null;
  readonly repoSha256?: HashId | null;
  readonly ggufSourceSha256?: HashId | null;
  readonly hfRepoSha256?: HashId | null;
  readonly githubOwnerSha256?: HashId | null;
  readonly ownerSha256?: HashId | null;
  readonly repoOwnerSha256?: HashId | null;
  readonly githubUserSha256?: HashId | null;
  readonly hfOwnerSha256?: HashId | null;
  readonly usernameSha256?: HashId | null;
  readonly accountSha256?: HashId | null;
  readonly emailSha256?: HashId | null;
  readonly authorEmailSha256?: HashId | null;
  readonly homePathSha256?: HashId | null;
}

/**
 * Pinned model artifact reference for a run, storing repository and GGUF source
 * identifiers strictly as SHA-256 digests.
 */
export interface RunModelPin extends ForbidPlaintextAccountFields {
  readonly servedAs?: string | null;
  readonly repoSha256?: HashId | null;
  readonly ggufSourceSha256?: HashId | null;
  readonly revision?: string | null;
  readonly ggufSha256?: HashId | null;
}

/**
 * Resource and budget caps approved before a run starts.
 */
export interface RunCaps extends ForbidPlaintextAccountFields {
  /** Maximum compute units authorized for the run. */
  readonly maxUnits: number;
  /** Maximum wall-clock runtime in seconds. */
  readonly maxWallSeconds: number;
  /** Optional safety margin in compute units. */
  readonly margin?: number | null;
}

/**
 * Pre-registration record for a governed run before execution begins.
 *
 * Captures the plan's SHA-256, the decision line's SHA-256, resource caps,
 * the planned card, and the approving actor ID. All account-naming identifiers
 * are stored only as SHA-256 digests.
 */
export interface RunPreRegistration extends ForbidPlaintextAccountFields {
  readonly id: HashId;
  readonly tenantId: TenantId;
  /** SHA-256 digest of the execution plan or launch specification. */
  readonly planSha256: HashId;
  /** SHA-256 digest of the pre-registered decision line or rule. */
  readonly decisionSha256: HashId;
  /** Approved resource and budget caps for the run. */
  readonly caps: RunCaps;
  /** Planned compute card or work card identifier (e.g. `"A100"`, `"CPU"`). */
  readonly plannedCard: string;
  /** Actor ID of the human or governance seat that approved the run. */
  readonly approvedBy: ActorId;
  /** ISO 8601 timestamp when the pre-registration was recorded. */
  readonly registeredAt: Timestamp;
  /** Optional SHA-256 of the GGUF repository identifier. */
  readonly ggufRepoSha256?: HashId | null;
  /** Optional SHA-256 of the hosted repository identifier. */
  readonly hostedRepoSha256?: HashId | null;
  /** Optional SHA-256 of the source repository identifier. */
  readonly repoSha256?: HashId | null;
  /** Optional SHA-256 of the GGUF source identifier. */
  readonly ggufSourceSha256?: HashId | null;
  /** Optional structured bundle of hashed account-naming identifiers. */
  readonly identifiers?: RunIdentifierHashes;
  /** Optional pinned model references (using `repoSha256` and `ggufSourceSha256`). */
  readonly models?: readonly RunModelPin[];
  /** Optional human-readable notes (must not contain plaintext account identifiers or balances). */
  readonly notes?: string;
}

/**
 * Lifecycle state of a governed run.
 */
export type RunStatus = "in_progress" | "completed" | "cancelled" | "lost";

/**
 * Basis describing how a run's cost was computed (e.g. `"rate_x_runtime"`).
 */
export type RunCostBasis = "rate_x_runtime" | "measured" | "estimate" | "pending" | "zero";

/**
 * Cost of a single run. Records the units spent by the run, the burn rate,
 * and the calculation basis (e.g. `rate_x_runtime`), never the account's
 * overall start or end balance.
 */
export interface RunCost extends ForbidPlaintextAccountFields {
  /** Compute units spent by this run (`>= 0`). */
  readonly unitsSpent: number;
  /** Burn rate in units per hour (`>= 0`). */
  readonly rate: number;
  /** Basis used to derive `unitsSpent` (e.g. `"rate_x_runtime"`). */
  readonly basis: RunCostBasis;
  /** Optional runtime in seconds used with `rate`. */
  readonly runtimeSeconds?: number | null;
  /** Optional unit label (e.g. `"colab_units"`). */
  readonly unit?: string;
}

/**
 * Retirement details when a run or its window output is retired.
 */
export interface RunRetirement extends ForbidPlaintextAccountFields {
  /** Why the run was retired. */
  readonly reason: string;
  /** Optional timestamp when the run was retired. */
  readonly retiredAt?: Timestamp | null;
  /** Optional actor ID who retired the run. */
  readonly retiredBy?: ActorId | null;
  /** Optional SHA-256 digest of the retirement notice. */
  readonly sha256?: HashId | null;
}

/**
 * Outcome record for a pre-registered run.
 *
 * References its `RunPreRegistration` via `preRegistrationId`, records the
 * lifecycle state (`in_progress`, `completed`, `cancelled`, `lost`), optional
 * `retirement` reason, timestamps, the outcome artifact's SHA-256, and the
 * run's cost (never the account's start or end balance).
 */
export interface RunOutcome extends ForbidPlaintextAccountFields {
  readonly id: HashId;
  readonly tenantId: TenantId;
  /** ID of the `RunPreRegistration` this outcome belongs to. */
  readonly preRegistrationId: HashId;
  /** Current or terminal state of the run. */
  readonly status: RunStatus;
  /** ISO 8601 timestamp when execution started. */
  readonly startedAt: Timestamp;
  /** ISO 8601 timestamp when execution ended (`null` while `in_progress`). */
  readonly endedAt: Timestamp | null;
  /** ISO 8601 timestamp when this outcome record was created. */
  readonly recordedAt: Timestamp;
  /** SHA-256 digest of the outcome artifact (`null` while `in_progress` if not yet materialized). */
  readonly outcomeSha256: HashId | null;
  /** Cost of the run (units spent, rate, and basis; never account balances). */
  readonly cost: RunCost;
  /** Optional structured retirement record (with `reason`). */
  readonly retirement?: RunRetirement | null;
  /** Optional shorthand retirement reason string. */
  readonly retirementReason?: string | null;
  /** Optional actor ID who recorded the outcome. */
  readonly recordedBy?: ActorId;
  /** Optional SHA-256 of the GGUF repository identifier. */
  readonly ggufRepoSha256?: HashId | null;
  /** Optional SHA-256 of the hosted repository identifier. */
  readonly hostedRepoSha256?: HashId | null;
  /** Optional SHA-256 of the source repository identifier. */
  readonly repoSha256?: HashId | null;
  /** Optional SHA-256 of the GGUF source identifier. */
  readonly ggufSourceSha256?: HashId | null;
  /** Optional structured bundle of hashed account-naming identifiers. */
  readonly identifiers?: RunIdentifierHashes;
  /** Optional human-readable notes (must not contain plaintext account identifiers or balances). */
  readonly notes?: string;
}
