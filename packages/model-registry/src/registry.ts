/**
 * Model lifecycle state machine — pure functions.
 *
 * All operations return new immutable {@link RegistryState} snapshots.
 * No input is ever mutated.
 */

import type {
  HashId,
  Model,
  ModelVersion,
  ModelVersionStatus,
  RunCostBasis,
  RunOutcome,
  RunPreRegistration,
  RunStatus,
} from "@cognate/types";
import type { RegistryState, TransitionEvent } from "./types.js";
import { RegistryError } from "./types.js";

/** Valid lifecycle transitions keyed by source state. */
const VALID_TRANSITIONS: Readonly<
  Record<ModelVersionStatus, readonly ModelVersionStatus[]>
> = {
  registered: ["evaluated"],
  evaluated: ["approved", "rejected"],
  approved: ["deployed"],
  deployed: ["retired"],
  rejected: [],
  retired: [],
};

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const FORBIDDEN_BALANCE_KEY_RE = /balance/i;

const FORBIDDEN_PLAINTEXT_ID_KEY_RE =
  /^(?:(?:gguf|hosted|hf|model|source|target)?_?repo|(?:gguf|model)?_?source|(?:github|hf|repo|model|account)?_?owner|(?:github|hf|repo)?_?user(?:_?name)?|account(?:_?name)?|(?:author|user)?_?email|author|home_?path|(?:github|hf)?_?handle)$/i;

const ACCOUNT_SHA256_KEY_RE =
  /^(?:(?:gguf|hosted|hf|model|source|target)?_?repo|(?:gguf|model)?_?source|(?:github|hf|repo|model|account)?_?owner|(?:github|hf|repo)?_?user(?:_?name)?|account(?:_?name)?|(?:author|user)?_?email|author|home_?path|(?:github|hf)?_?handle)_?sha256$/i;

const ANY_SHA256_KEY_RE = /(?:Sha256|_sha256)$/i;

const EMAIL_VALUE_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

const HOME_PATH_VALUE_RE =
  /(?:[A-Za-z][:$][\\/]+Users[\\/]+(?!Public\b|Default\b|All Users\b)|(?:^|[\\/])Users[\\/]+(?!Public\b|Default\b|All Users\b)|(?:^|[\\/])home[\\/]+|(?:^|[\s"'(=])~[\\/]+)[^\s"'/\\]+/i;

const REPO_URL_OR_HANDLE_VALUE_RE =
  /(?:https?:\/\/)?(?:huggingface\.co|hf\.co|github\.com)\/[A-Za-z0-9._-]+|hf:\/\/[A-Za-z0-9._-]+|(?<![A-Za-z0-9._%+-])@[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\b/i;

const CANDIDATE_OWNER_REPO_RE =
  /(?<![A-Za-z0-9._/:~-])([A-Za-z][A-Za-z0-9_-]{1,38})\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})(?:\/([A-Za-z0-9._-]{1,120}\.(?:gguf|safetensors|bin|pt|pth|onnx)))?(?![A-Za-z0-9._/:-])/g;

const NON_ACCOUNT_TOKEN_RE =
  /^(?:v?\d+(?:\.\d+)*[a-z]?|(?:w|window|run|lane|arm|card|step|stage|phase|tier|r|e|s)\d[a-z0-9_-]*|arm[a-z0-9_-]*|a100|h100|b200|l4|t4|v100|rtx\d+|sm\d+|fp\d+|bf16|int\d+|q\d+_[a-z0-9_]+|node\d+|pnpm\d+|cuda\d+|cpu|gpu|tpu)$/i;

const WORKSPACE_DIR_RE =
  /^(?:src|dist|lib|bin|pkg|packages|tests|test|docs|site|scripts|schemas|config|stub|results|receipts|logs|data|out|tmp|worktrees|node_modules|public|assets|handbook|content|routes|middleware)$/i;

const SOURCE_OR_LOG_FILE_RE =
  /\.(?:log|json|jsonl|txt|md|ts|tsx|js|mjs|cjs|py|sh|yml|yaml|toml|lock|csv|html|css|sql)$/i;

const RATIO_OR_PROSE_PAIR_RE =
  /^(?:s|sec|secs|second|seconds|ms|min|mins|minute|minutes|hr|hrs|hour|hours|h|d|day|days|unit|units|tok|tokens|req|reqs|request|requests|call|calls|step|steps|epoch|epochs|run|runs|b|kb|mb|gb|tb|kib|mib|gib|tib|pass|fail|true|false|yes|no|on|off|in|out|read|write|train|val|valid|validation|test|dev|prod|staging|main|master|ci|cd|http|https|tcp|ip|udp|tls|ssl|ws|wss|grpc|rest|utf8|ascii|na|none|null|all|any|other|or|and|with|without|from|to|by|of|per|via|vs|max|avg|mean|sum|total|count|part|page|line|col|row|idx|id)$/i;

function hasOwnerRepoSlug(value: string): boolean {
  for (const match of value.matchAll(CANDIDATE_OWNER_REPO_RE)) {
    const owner = match[1]!;
    const repo = match[2]!;
    const artifact = match[3];

    if (owner.endsWith("-")) continue;
    if (NON_ACCOUNT_TOKEN_RE.test(owner)) continue;
    if (WORKSPACE_DIR_RE.test(owner)) continue;
    if (artifact === undefined && SOURCE_OR_LOG_FILE_RE.test(repo)) continue;
    if (
      artifact === undefined &&
      (RATIO_OR_PROSE_PAIR_RE.test(owner) || RATIO_OR_PROSE_PAIR_RE.test(repo))
    ) {
      continue;
    }
    return true;
  }
  return false;
}

const VALID_RUN_STATUSES: readonly RunStatus[] = [
  "in_progress",
  "completed",
  "cancelled",
  "lost",
];

const VALID_RUN_COST_BASES: readonly RunCostBasis[] = [
  "rate_x_runtime",
  "measured",
  "estimate",
  "pending",
  "zero",
];

/**
 * Create an empty registry state.
 */
export function createRegistry(): RegistryState {
  return {
    models: {},
    versions: {},
    transitions: {},
  };
}

/**
 * Register a new model in the registry.
 *
 * @param state Current registry snapshot.
 * @param model The model to register.
 * @returns A new registry snapshot containing the model.
 * @throws {RegistryError} If a model with the same id already exists.
 */
export function registerModel(state: RegistryState, model: Model): RegistryState {
  if (state.models[model.id] !== undefined) {
    throw new RegistryError({
      code: "MODEL_ALREADY_EXISTS",
      message: `Model with id "${model.id}" is already registered.`,
      hint: "Use a unique model id or check existing models.",
    });
  }
  return {
    ...state,
    models: { ...state.models, [model.id]: model },
  };
}

/**
 * Register a new version for an existing model.
 *
 * @param state Current registry snapshot.
 * @param modelVersion The version to register.
 * @returns A new registry snapshot containing the version.
 * @throws {RegistryError} If the parent model is missing or the version id already exists.
 */
export function registerVersion(
  state: RegistryState,
  modelVersion: ModelVersion,
): RegistryState {
  if (state.versions[modelVersion.id] !== undefined) {
    throw new RegistryError({
      code: "VERSION_ALREADY_EXISTS",
      message: `Model version with id "${modelVersion.id}" is already registered.`,
      hint: "Use a unique version id.",
    });
  }
  if (state.models[modelVersion.modelId] === undefined) {
    throw new RegistryError({
      code: "MODEL_NOT_FOUND",
      message: `Model with id "${modelVersion.modelId}" does not exist.`,
      hint: "Register the model before adding versions to it.",
    });
  }
  return {
    ...state,
    versions: { ...state.versions, [modelVersion.id]: modelVersion },
  };
}

/**
 * Transition a model version from one lifecycle state to another.
 *
 * @param state Current registry snapshot.
 * @param modelVersionId The version to transition.
 * @param from Expected current state.
 * @param to Target state.
 * @param actorId Who authorized the transition.
 * @param reason Human-readable reason for the transition.
 * @returns A new registry snapshot reflecting the transition.
 * @throws {RegistryError} If the version is missing, the current state mismatches, or the transition is invalid.
 */
export function transitionVersion(
  state: RegistryState,
  modelVersionId: string,
  from: ModelVersionStatus,
  to: ModelVersionStatus,
  actorId: string,
  reason: string,
): RegistryState {
  const version = state.versions[modelVersionId];
  if (version === undefined) {
    throw new RegistryError({
      code: "VERSION_NOT_FOUND",
      message: `Model version with id "${modelVersionId}" does not exist.`,
      hint: "Verify the version id or register it first.",
    });
  }

  if (version.status !== from) {
    throw new RegistryError({
      code: "INVALID_TRANSITION_SOURCE",
      message: `Version "${modelVersionId}" is in state "${version.status}", not "${from}".`,
      hint: "Ensure the 'from' state matches the current version state.",
    });
  }

  const allowed = VALID_TRANSITIONS[from];
  if (allowed === undefined || !allowed.includes(to)) {
    throw new RegistryError({
      code: "INVALID_TRANSITION",
      message: `Transition from "${from}" to "${to}" is not allowed.`,
      hint: "Consult the valid transition rules for the model lifecycle.",
    });
  }

  const timestamp = new Date().toISOString();
  const event: TransitionEvent = {
    modelVersionId,
    from,
    to,
    actorId,
    reason,
    timestamp,
  };

  const updatedVersion: ModelVersion = { ...version, status: to };
  const versionTransitions = state.transitions[modelVersionId] ?? [];

  return {
    ...state,
    versions: { ...state.versions, [modelVersionId]: updatedVersion },
    transitions: {
      ...state.transitions,
      [modelVersionId]: [...versionTransitions, event],
    },
  };
}

/**
 * Get all versions for a model, ordered by creation time (ascending).
 *
 * @param state Current registry snapshot.
 * @param modelId The model id.
 * @returns Ordered list of versions.
 */
export function getVersionHistory(
  state: RegistryState,
  modelId: string,
): readonly ModelVersion[] {
  return Object.values(state.versions)
    .filter((v): v is ModelVersion => v !== undefined && v.modelId === modelId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Get the most recently deployed version for a model.
 *
 * @param state Current registry snapshot.
 * @param modelId The model id.
 * @returns The latest deployed version, or `undefined` if none.
 */
export function getCurrentDeployedVersion(
  state: RegistryState,
  modelId: string,
): ModelVersion | undefined {
  const versions = getVersionHistory(state, modelId);
  return versions.filter((v) => v.status === "deployed").pop();
}

/**
 * Check whether a value is a 64-character lowercase hexadecimal SHA-256 digest.
 */
export function isSha256Hex(value: unknown): value is HashId {
  return typeof value === "string" && SHA256_HEX_RE.test(value);
}

function containsPlaintextAccountValue(value: string): boolean {
  return (
    EMAIL_VALUE_RE.test(value) ||
    HOME_PATH_VALUE_RE.test(value) ||
    REPO_URL_OR_HANDLE_VALUE_RE.test(value) ||
    hasOwnerRepoSlug(value)
  );
}

function requireNonEmptyString(
  value: unknown,
  fieldName: string,
  code: string,
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RegistryError({
      code,
      message: `Field "${fieldName}" must be a non-empty string.`,
      hint: `Provide a non-empty string for "${fieldName}".`,
    });
  }
}

/**
 * Enforce the New 4 hashed-identifier rule and no-balance rule across a run record.
 *
 * Refuses:
 * - any forbidden plaintext account-naming key (`ggufRepo`, `gguf_source`, `hostedRepo`,
 *   `hfRepo`, `repo`, `githubOwner`, `account`, `email`, `authorEmail`, `homePath`);
 * - any non-SHA256 value in a `*Sha256` field (`ggufRepoSha256`, `hostedRepoSha256`,
 *   `repoSha256`, `ggufSourceSha256`, etc.);
 * - any string value containing an HF repo id, GitHub owner/repo, email, or home path;
 * - any account-balance key (`startBalance`, `endBalance`, `startBalanceBeforeLaunch`,
 *   `accountBalance`).
 */
export function validateHashedIdentifiers(
  record: unknown,
  pathPrefix = "record",
): void {
  if (record === null || record === undefined) return;
  if (typeof record === "string") {
    if (containsPlaintextAccountValue(record)) {
      throw new RegistryError({
        code: "PLAINTEXT_ACCOUNT_IDENTIFIER",
        message: `Field "${pathPrefix}" contains a plaintext account-naming identifier (HF repo, GitHub owner, email, or home path).`,
        hint: "Hash account-naming identifiers to 64-character lowercase SHA-256 digests before recording.",
      });
    }
    return;
  }
  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      validateHashedIdentifiers(record[i], `${pathPrefix}[${i}]`);
    }
    return;
  }
  if (typeof record === "object") {
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      const fieldPath = `${pathPrefix}.${key}`;
      if (FORBIDDEN_BALANCE_KEY_RE.test(key)) {
        throw new RegistryError({
          code: "RUN_BALANCE_FORBIDDEN",
          message: `Account balance field "${key}" at "${fieldPath}" is forbidden in Cognate run records.`,
          hint: "Record only the run's cost (unitsSpent, rate, basis), never the account's start or end balance.",
        });
      }
      if (FORBIDDEN_PLAINTEXT_ID_KEY_RE.test(key)) {
        throw new RegistryError({
          code: "PLAINTEXT_ACCOUNT_IDENTIFIER",
          message: `Plaintext account-naming field "${key}" at "${fieldPath}" is forbidden; use its *Sha256 counterpart.`,
          hint: "Store account-naming identifiers only as 64-character lowercase SHA-256 digests in *Sha256 fields.",
        });
      }
      if (ACCOUNT_SHA256_KEY_RE.test(key) && value !== undefined && value !== null) {
        if (!isSha256Hex(value)) {
          throw new RegistryError({
            code: "PLAINTEXT_ACCOUNT_IDENTIFIER",
            message: `Hashed identifier field "${fieldPath}" must be a 64-character lowercase SHA-256 hex digest.`,
            hint: "Hash the HF repo id, GitHub owner, email, or home path with SHA-256 before storing.",
          });
        }
        continue;
      }
      if (ANY_SHA256_KEY_RE.test(key) && value !== undefined && value !== null) {
        if (!isSha256Hex(value)) {
          const isPlainAccount =
            typeof value === "string" && containsPlaintextAccountValue(value);
          throw new RegistryError({
            code: isPlainAccount
              ? "PLAINTEXT_ACCOUNT_IDENTIFIER"
              : "INVALID_SHA256_DIGEST",
            message: `Digest field "${fieldPath}" must be a 64-character lowercase SHA-256 hex string.`,
            hint: "Supply a 64-character lowercase hexadecimal SHA-256 digest.",
          });
        }
        continue;
      }
      validateHashedIdentifiers(value, fieldPath);
    }
  }
}

/**
 * Validate a {@link RunPreRegistration} record.
 */
export function validateRunPreRegistration(
  preRegistration: RunPreRegistration,
): void {
  validateHashedIdentifiers(preRegistration, "preRegistration");
  requireNonEmptyString(
    preRegistration.id,
    "preRegistration.id",
    "INVALID_RUN_PREREGISTRATION",
  );
  requireNonEmptyString(
    preRegistration.tenantId,
    "preRegistration.tenantId",
    "INVALID_RUN_PREREGISTRATION",
  );
  const caps = preRegistration.caps;
  if (
    !caps ||
    typeof caps !== "object" ||
    typeof caps.maxUnits !== "number" ||
    !Number.isFinite(caps.maxUnits) ||
    caps.maxUnits < 0 ||
    typeof caps.maxWallSeconds !== "number" ||
    !Number.isFinite(caps.maxWallSeconds) ||
    caps.maxWallSeconds <= 0 ||
    (caps.margin !== undefined &&
      caps.margin !== null &&
      (typeof caps.margin !== "number" ||
        !Number.isFinite(caps.margin) ||
        caps.margin < 0))
  ) {
    throw new RegistryError({
      code: "INVALID_RUN_CAPS",
      message:
        "preRegistration.caps requires finite maxUnits >= 0, maxWallSeconds > 0, and optional margin >= 0.",
      hint: "Specify valid numeric resource caps for the run.",
    });
  }
  requireNonEmptyString(
    preRegistration.plannedCard,
    "preRegistration.plannedCard",
    "INVALID_RUN_PREREGISTRATION",
  );
  requireNonEmptyString(
    preRegistration.approvedBy,
    "preRegistration.approvedBy",
    "INVALID_RUN_PREREGISTRATION",
  );
  requireNonEmptyString(
    preRegistration.registeredAt,
    "preRegistration.registeredAt",
    "INVALID_RUN_PREREGISTRATION",
  );
}

/**
 * Validate a {@link RunOutcome} record and optional linkage to its {@link RunPreRegistration}.
 */
export function validateRunOutcome(
  outcome: RunOutcome,
  preRegistration?: RunPreRegistration,
): void {
  validateHashedIdentifiers(outcome, "outcome");
  requireNonEmptyString(outcome.id, "outcome.id", "INVALID_RUN_OUTCOME");
  requireNonEmptyString(outcome.tenantId, "outcome.tenantId", "INVALID_RUN_OUTCOME");
  requireNonEmptyString(
    outcome.preRegistrationId,
    "outcome.preRegistrationId",
    "MISSING_PREREGISTRATION_REF",
  );

  if (preRegistration !== undefined) {
    if (outcome.preRegistrationId !== preRegistration.id) {
      throw new RegistryError({
        code: "PREREGISTRATION_MISMATCH",
        message: `Outcome "${outcome.id}" references pre-registration "${outcome.preRegistrationId}", expected "${preRegistration.id}".`,
        hint: "Link the outcome to the pre-registration it fulfills.",
      });
    }
    if (outcome.tenantId !== preRegistration.tenantId) {
      throw new RegistryError({
        code: "TENANT_MISMATCH",
        message: `Outcome tenant "${outcome.tenantId}" does not match pre-registration tenant "${preRegistration.tenantId}".`,
        hint: "Ensure the outcome and its pre-registration belong to the same tenant.",
      });
    }
  }

  if (!VALID_RUN_STATUSES.includes(outcome.status)) {
    throw new RegistryError({
      code: "INVALID_RUN_STATUS",
      message: `Invalid run outcome status "${String(outcome.status)}".`,
      hint: "Use one of: in_progress, completed, cancelled, lost.",
    });
  }

  requireNonEmptyString(outcome.startedAt, "outcome.startedAt", "INVALID_RUN_OUTCOME");
  requireNonEmptyString(
    outcome.recordedAt,
    "outcome.recordedAt",
    "INVALID_RUN_OUTCOME",
  );

  if (outcome.status === "in_progress") {
    if (outcome.endedAt !== null) {
      throw new RegistryError({
        code: "INVALID_RUN_OUTCOME",
        message: "An in_progress run outcome must have endedAt set to null.",
        hint: "Set endedAt only when the run reaches completed, cancelled, or lost.",
      });
    }
  } else {
    requireNonEmptyString(outcome.endedAt, "outcome.endedAt", "INVALID_RUN_OUTCOME");
  }

  if (outcome.status === "completed" && !isSha256Hex(outcome.outcomeSha256)) {
    throw new RegistryError({
      code: "INVALID_SHA256_DIGEST",
      message:
        "A completed run outcome requires a 64-character lowercase SHA-256 outcomeSha256.",
      hint: "Compute the SHA-256 digest of the outcome artifact.",
    });
  }

  const cost = outcome.cost;
  if (!cost || typeof cost !== "object") {
    throw new RegistryError({
      code: "INVALID_RUN_COST",
      message: "outcome.cost is required.",
      hint: "Provide unitsSpent, rate, and basis on outcome.cost.",
    });
  }
  if ((cost.basis as string) === "balance") {
    throw new RegistryError({
      code: "RUN_BALANCE_FORBIDDEN",
      message:
        'outcome.cost.basis cannot be "balance"; account balances are forbidden in run records.',
      hint: 'Record the run cost using "rate_x_runtime", "measured", "estimate", "pending", or "zero".',
    });
  }
  if (
    typeof cost.unitsSpent !== "number" ||
    !Number.isFinite(cost.unitsSpent) ||
    cost.unitsSpent < 0 ||
    typeof cost.rate !== "number" ||
    !Number.isFinite(cost.rate) ||
    cost.rate < 0 ||
    !VALID_RUN_COST_BASES.includes(cost.basis) ||
    (cost.runtimeSeconds !== undefined &&
      cost.runtimeSeconds !== null &&
      (typeof cost.runtimeSeconds !== "number" ||
        !Number.isFinite(cost.runtimeSeconds) ||
        cost.runtimeSeconds < 0))
  ) {
    throw new RegistryError({
      code: "INVALID_RUN_COST",
      message:
        "outcome.cost requires finite unitsSpent >= 0, rate >= 0, and a valid basis.",
      hint: "Provide valid non-negative cost numbers and a recognized cost basis.",
    });
  }

  if (outcome.retirement !== undefined && outcome.retirement !== null) {
    requireNonEmptyString(
      outcome.retirement.reason,
      "outcome.retirement.reason",
      "INVALID_RUN_RETIREMENT",
    );
  }
  if (outcome.retirementReason !== undefined && outcome.retirementReason !== null) {
    requireNonEmptyString(
      outcome.retirementReason,
      "outcome.retirementReason",
      "INVALID_RUN_RETIREMENT",
    );
  }
}

/**
 * Record a validated {@link RunPreRegistration} in the registry snapshot.
 */
export function preRegisterRun(
  state: RegistryState,
  preRegistration: RunPreRegistration,
): RegistryState {
  validateRunPreRegistration(preRegistration);
  const existing = state.runPreRegistrations ?? {};
  if (existing[preRegistration.id] !== undefined) {
    throw new RegistryError({
      code: "RUN_ALREADY_PREREGISTERED",
      message: `Run pre-registration with id "${preRegistration.id}" already exists.`,
      hint: "Use a unique pre-registration id.",
    });
  }
  return {
    ...state,
    runPreRegistrations: {
      ...existing,
      [preRegistration.id]: preRegistration,
    },
  };
}

/**
 * Look up a pre-registered run by id.
 */
export function getRunPreRegistration(
  state: RegistryState,
  preRegistrationId: string,
): RunPreRegistration | undefined {
  return state.runPreRegistrations?.[preRegistrationId];
}

/**
 * Return all recorded outcomes for a pre-registered run, ordered by `recordedAt`.
 */
export function getRunOutcomes(
  state: RegistryState,
  preRegistrationId: string,
): readonly RunOutcome[] {
  const outcomes = state.runOutcomes ?? {};
  return Object.values(outcomes)
    .filter(
      (o): o is RunOutcome =>
        o !== undefined && o.preRegistrationId === preRegistrationId,
    )
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/**
 * Record a validated {@link RunOutcome} linked to an existing {@link RunPreRegistration}.
 */
export function recordRunOutcome(
  state: RegistryState,
  outcome: RunOutcome,
): RegistryState {
  const preReg = getRunPreRegistration(state, outcome.preRegistrationId);
  if (preReg === undefined) {
    throw new RegistryError({
      code: "PREREGISTRATION_NOT_FOUND",
      message: `Run pre-registration "${outcome.preRegistrationId}" does not exist.`,
      hint: "Pre-register the run before recording its outcome.",
    });
  }
  validateRunOutcome(outcome, preReg);

  const existingOutcomes = state.runOutcomes ?? {};
  if (existingOutcomes[outcome.id] !== undefined) {
    throw new RegistryError({
      code: "RUN_OUTCOME_ALREADY_EXISTS",
      message: `Run outcome with id "${outcome.id}" is already recorded.`,
      hint: "Use a unique outcome id.",
    });
  }

  const priorForRun = getRunOutcomes(state, outcome.preRegistrationId);
  const terminalPrior = priorForRun.find((o) => o.status !== "in_progress");
  if (terminalPrior !== undefined) {
    throw new RegistryError({
      code: "INVALID_RUN_TRANSITION",
      message: `Run "${outcome.preRegistrationId}" has already reached terminal state "${terminalPrior.status}" and cannot transition to "${outcome.status}".`,
      hint: "Only in_progress runs may transition to completed, cancelled, or lost.",
    });
  }

  return {
    ...state,
    runOutcomes: {
      ...existingOutcomes,
      [outcome.id]: outcome,
    },
  };
}
