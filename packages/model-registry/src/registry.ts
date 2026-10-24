/**
 * Model lifecycle state machine — pure functions.
 *
 * All operations return new immutable {@link RegistryState} snapshots.
 * No input is ever mutated.
 */

import type { Evaluation, Model, ModelVersion, ModelVersionStatus } from "@cognate/types";
import type { RegistryState, TransitionEvent, TransitionOptions } from "./types.js";
import { RegistryError } from "./types.js";

/** Valid lifecycle transitions keyed by source state. */
const VALID_TRANSITIONS: Readonly<
  Record<ModelVersionStatus, readonly ModelVersionStatus[]>
> = {
  registered: ["evaluated"],
  evaluated: ["approved", "rejected"],
  // An approval can be withdrawn before deploy, e.g. when a replication reverses the evaluation it rested on.
  approved: ["deployed", "rejected"],
  deployed: ["retired"],
  rejected: [],
  retired: [],
};

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
 * @param options `evaluationIds`: the evaluations recorded on this version that the decision rests on.
 * @returns A new registry snapshot reflecting the transition.
 * @throws {RegistryError} If the version is missing, the current state mismatches, the transition is invalid, or a
 *   cited evaluation is not recorded on this version.
 */
export function transitionVersion(
  state: RegistryState,
  modelVersionId: string,
  from: ModelVersionStatus,
  to: ModelVersionStatus,
  actorId: string,
  reason: string,
  options: TransitionOptions = {},
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

  const cited = options.evaluationIds;
  const rule = options.requireEvaluationCitations ?? false;
  if (rule !== false && rule !== "decisions" && rule !== "all") {
    throw new RegistryError({
      code: "INVALID_CITATION_RULE",
      message: `requireEvaluationCitations must be false, "decisions" or "all", not ${JSON.stringify(rule)}.`,
      hint: "Use false (the default), \"decisions\" (approve and reject must cite) or \"all\" (every transition must cite).",
    });
  }
  const mustCite = rule === "all" || (rule === "decisions" && (to === "approved" || to === "rejected"));
  if (mustCite && cited === undefined) {
    throw new RegistryError({
      code: "EVALUATION_CITATION_REQUIRED",
      message: `Transition of "${modelVersionId}" to "${to}" must cite the evaluations it rests on.`,
      hint: "Record the evaluations on this version, then pass their ids as evaluationIds.",
    });
  }
  if (cited !== undefined) {
    if (cited.length === 0) {
      throw new RegistryError({
        code: "EVALUATION_IDS_EMPTY",
        message: `Transition of "${modelVersionId}" cites an empty list of evaluations.`,
        hint: "Cite at least one recorded evaluation, or omit evaluationIds.",
      });
    }
    const recorded = new Set<string>(getEvaluations(state, modelVersionId).map((e) => e.id as string));
    const missing = cited.filter((id) => !recorded.has(id));
    if (missing.length > 0) {
      throw new RegistryError({
        code: "EVALUATION_NOT_FOUND",
        message: `Version "${modelVersionId}" has no recorded evaluation ${missing.map((id) => `"${id}"`).join(", ")}.`,
        hint: "Record the evaluation on this version first; a decision can only cite its own version's evaluations.",
      });
    }
  }

  const timestamp = new Date().toISOString();
  const event: TransitionEvent = {
    modelVersionId,
    from,
    to,
    actorId,
    reason,
    timestamp,
    ...(cited !== undefined ? { evaluationIds: [...cited] } : {}),
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

/** States in which a version takes no more evaluations. */
const CLOSED_STATES: readonly ModelVersionStatus[] = ["rejected", "retired"];

/**
 * Record an evaluation on a model version. Any number can attach (a run, its replication, a pooled result); recording
 * is not a transition, so the version's state does not change. A decision cites the evaluations it rests on through
 * `transitionVersion`'s `evaluationIds`.
 *
 * @param state Current registry snapshot.
 * @param evaluation The evaluation, naming its version in `modelVersionId`.
 * @returns A new registry snapshot with the evaluation appended to its version's list.
 * @throws {RegistryError} If the version is missing or closed, the tenant differs, or the evaluation id is taken.
 */
export function recordEvaluation(state: RegistryState, evaluation: Evaluation): RegistryState {
  const version = state.versions[evaluation.modelVersionId];
  if (version === undefined) {
    throw new RegistryError({
      code: "VERSION_NOT_FOUND",
      message: `Model version with id "${evaluation.modelVersionId}" does not exist.`,
      hint: "Register the version before recording an evaluation on it.",
    });
  }
  if (version.tenantId !== evaluation.tenantId) {
    throw new RegistryError({
      code: "EVALUATION_TENANT_MISMATCH",
      message: `Evaluation "${evaluation.id}" is for tenant "${evaluation.tenantId}", but its version belongs to another tenant.`,
      hint: "Record the evaluation under the version's own tenant.",
    });
  }
  if (CLOSED_STATES.includes(version.status)) {
    throw new RegistryError({
      code: "EVALUATION_ON_CLOSED_VERSION",
      message: `Version "${evaluation.modelVersionId}" is ${version.status}; it takes no more evaluations.`,
      hint: "Register a new version to evaluate it.",
    });
  }
  const all = state.evaluations ?? {};
  for (const list of Object.values(all)) {
    if (list?.some((e) => e.id === evaluation.id)) {
      throw new RegistryError({
        code: "EVALUATION_ALREADY_RECORDED",
        message: `An evaluation with id "${evaluation.id}" is already recorded.`,
        hint: "Use a unique evaluation id.",
      });
    }
  }
  return {
    ...state,
    evaluations: {
      ...all,
      [evaluation.modelVersionId]: [...(all[evaluation.modelVersionId] ?? []), evaluation],
    },
  };
}

/**
 * The evaluations recorded on a version, in the order they were recorded.
 *
 * @param state Current registry snapshot (a snapshot from before evaluations existed reads as none).
 * @param modelVersionId The version id.
 */
export function getEvaluations(state: RegistryState, modelVersionId: string): readonly Evaluation[] {
  return state.evaluations?.[modelVersionId] ?? [];
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
