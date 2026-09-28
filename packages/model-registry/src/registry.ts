/**
 * Model lifecycle state machine — pure functions.
 *
 * All operations return new immutable {@link RegistryState} snapshots.
 * No input is ever mutated.
 */

import type { Model, ModelVersion, ModelVersionState } from "@cognate/types";
import type { RegistryState, TransitionEvent } from "./types.js";
import { RegistryError } from "./types.js";

/** Valid lifecycle transitions keyed by source state. */
const VALID_TRANSITIONS: Readonly<
  Record<ModelVersionState, readonly ModelVersionState[]>
> = {
  registered: ["evaluated"],
  evaluated: ["approved", "rejected"],
  approved: ["deployed"],
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
 * @returns A new registry snapshot reflecting the transition.
 * @throws {RegistryError} If the version is missing, the current state mismatches, or the transition is invalid.
 */
export function transitionVersion(
  state: RegistryState,
  modelVersionId: string,
  from: ModelVersionState,
  to: ModelVersionState,
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

  if (version.state !== from) {
    throw new RegistryError({
      code: "INVALID_TRANSITION_SOURCE",
      message: `Version "${modelVersionId}" is in state "${version.state}", not "${from}".`,
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

  const updatedVersion: ModelVersion = { ...version, state: to };
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
  return versions.filter((v) => v.state === "deployed").pop();
}
