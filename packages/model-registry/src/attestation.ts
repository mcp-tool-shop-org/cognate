/**
 * Attestia integration for the model registry.
 *
 * Wraps pure registry transitions with cryptographic event logging
 * and Merkle-tree hashing for version lineage proof.
 */

import { createHash, randomUUID } from "node:crypto";
import type { Evaluation, ModelVersion, ModelVersionStatus, RunOutcome, RunPreRegistration } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import { MerkleTree } from "@mcptoolshop/attestia/proof";
import type { RegistryState, TransitionEvent, TransitionOptions } from "./types.js";
import { RegistryError } from "./types.js";
import {
  getRunPreRegistration,
  preRegisterRun,
  recordEvaluation,
  recordRunOutcome,
  registerVersion,
  transitionVersion,
  validateHashedIdentifiers,
  validateRunOutcome,
  validateRunPreRegistration,
} from "./registry.js";

function cognateEvent(
  type: string,
  actor: string,
  timestamp: string,
  correlationId: string,
  payload: Record<string, unknown>,
  causationId?: string,
): DomainEvent {
  return {
    type,
    metadata: {
      eventId: randomUUID(),
      timestamp,
      actor,
      correlationId,
      source: "external",
      ...(causationId !== undefined ? { causationId } : {}),
    },
    payload,
  };
}

export interface AttestTransitionConfig {
  readonly eventStore: Pick<EventStore, "append">;
  readonly tenantId: string;
  readonly streamPrefix?: string;
}

export type AttestRunConfig = AttestTransitionConfig;

export interface AttestedRunEvent<TRecord> {
  readonly eventId: string;
  readonly streamId: string;
  readonly record: TRecord;
}

function makeStreamId(config: AttestTransitionConfig, suffix = "transitions"): string {
  return `${config.streamPrefix ?? "cognate"}-${config.tenantId}-${suffix}`;
}

async function appendOrThrow(
  config: AttestTransitionConfig,
  streamId: string,
  event: DomainEvent,
  what: string,
): Promise<void> {
  try {
    await config.eventStore.append(streamId, [event]);
  } catch (err) {
    throw new RegistryError({
      code: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: `The ${what} was not returned. The caller keeps the registry it passed in.`,
    });
  }
}

/**
 * Record an evaluation on a version and append `cognate.evaluation.recorded` to the tenant's evaluations stream.
 *
 * One append, so the log and the returned snapshot can't disagree: the snapshot is returned only after the append
 * succeeds.
 */
export async function attestEvaluation(
  state: RegistryState,
  config: AttestTransitionConfig,
  evaluation: Evaluation,
): Promise<RegistryState> {
  // The stream is named by config's tenant, so an evaluation for another tenant would land where its own tenant
  // can't prove it.
  if (evaluation.tenantId !== config.tenantId) {
    throw new RegistryError({
      code: "EVALUATION_TENANT_MISMATCH",
      message: `Evaluation tenant "${evaluation.tenantId}" does not match the stream's tenant "${config.tenantId}".`,
      hint: "Attest the evaluation with a config for its own tenant.",
    });
  }
  const newState = recordEvaluation(state, evaluation);
  await appendOrThrow(
    config,
    makeStreamId(config, "evaluations"),
    cognateEvent("cognate.evaluation.recorded", evaluation.evaluator, evaluation.evaluatedAt, evaluation.modelVersionId, {
      id: evaluation.id,
      tenantId: evaluation.tenantId,
      modelVersionId: evaluation.modelVersionId,
      evaluator: evaluation.evaluator,
      evaluatedAt: evaluation.evaluatedAt,
      metrics: evaluation.metrics.map((m) => ({ ...m })),
      overall: evaluation.overall,
      notes: evaluation.notes,
    }),
    "evaluation",
  );
  return newState;
}

function makeRunsStreamId(config: AttestRunConfig): string {
  return `${config.streamPrefix ?? "cognate"}-${config.tenantId}-runs`;
}

function isRegistryState(value: unknown): value is RegistryState {
  return (
    value !== null &&
    typeof value === "object" &&
    "models" in value &&
    "versions" in value &&
    !("eventStore" in value)
  );
}

/**
 * Register a new model version (enforcing initial `status: "registered"`) and append
 * `cognate.model.version.registered` to the tenant's transitions stream with the signer as actor.
 */
export async function attestRegisterVersion(
  state: RegistryState,
  config: AttestTransitionConfig,
  modelVersion: ModelVersion,
  actorId: string,
): Promise<RegistryState> {
  validateHashedIdentifiers(actorId, "version.actorId");
  const newState = registerVersion(state, modelVersion);
  const timestamp = new Date().toISOString();
  await appendOrThrow(
    config,
    makeStreamId(config),
    cognateEvent("cognate.model.version.registered", actorId, timestamp, modelVersion.id, {
      modelVersionId: modelVersion.id,
      modelId: modelVersion.modelId,
      tenantId: modelVersion.tenantId,
      versionNumber: modelVersion.versionNumber,
      status: "registered",
      actorId,
      timestamp,
    }),
    "version registration",
  );
  return newState;
}

/**
 * Transition a model version and append the Attestia event.
 *
 * `transitionVersion` returns a new snapshot and does not mutate `state`.
 * That snapshot is returned only after the append succeeds.
 */
export async function attestTransitionVersion(
  state: RegistryState,
  config: AttestTransitionConfig,
  modelVersionId: string,
  from: ModelVersionStatus,
  to: ModelVersionStatus,
  actorId: string,
  reason: string,
  options: TransitionOptions = {},
): Promise<RegistryState> {
  const newState = transitionVersion(state, modelVersionId, from, to, actorId, reason, options);

  const event: TransitionEvent = newState.transitions[modelVersionId]?.slice(-1)[0] ?? {
    modelVersionId,
    from,
    to,
    actorId,
    reason,
    timestamp: new Date().toISOString(),
  };

  try {
    await config.eventStore.append(
      makeStreamId(config),
      [
        cognateEvent(
          "cognate.model.transitioned",
          event.actorId,
          event.timestamp,
          event.modelVersionId,
          {
            modelVersionId: event.modelVersionId,
            from: event.from,
            to: event.to,
            actorId: event.actorId,
            reason: event.reason,
            timestamp: event.timestamp,
            ...(event.evaluationIds !== undefined ? { evaluationIds: [...event.evaluationIds] } : {}),
          },
        ),
      ],
    );
  } catch (err) {
    throw new RegistryError({
      code: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The transition was not returned. The caller keeps the registry it passed in.",
    });
  }

  return newState;
}

/**
 * Validate a {@link RunPreRegistration} (enforcing the hashed-identifier rule
 * and no-balance rule), record it in the registry snapshot when provided, and
 * append `cognate.run.preregistered` to `cognate-${tenantId}-runs`.
 */
export async function attestRunPreRegistered(
  state: RegistryState,
  config: AttestRunConfig,
  preRegistration: RunPreRegistration,
): Promise<RegistryState>;
export async function attestRunPreRegistered(
  config: AttestRunConfig,
  preRegistration: RunPreRegistration,
): Promise<AttestedRunEvent<RunPreRegistration>>;
export async function attestRunPreRegistered(
  stateOrConfig: RegistryState | AttestRunConfig,
  configOrPreReg: AttestRunConfig | RunPreRegistration,
  maybePreReg?: RunPreRegistration,
): Promise<RegistryState | AttestedRunEvent<RunPreRegistration>> {
  const hasState = isRegistryState(stateOrConfig);
  const config = (hasState ? configOrPreReg : stateOrConfig) as AttestRunConfig;
  const preRegistration = (hasState ? maybePreReg : configOrPreReg) as RunPreRegistration;

  const nextState = hasState
    ? preRegisterRun(stateOrConfig, preRegistration)
    : (validateRunPreRegistration(preRegistration), undefined);

  if (preRegistration.tenantId !== config.tenantId) {
    throw new RegistryError({
      code: "TENANT_MISMATCH",
      message: `Pre-registration tenant "${preRegistration.tenantId}" does not match config tenant "${config.tenantId}".`,
      hint: "Ensure the pre-registration tenantId matches the stream config tenantId.",
    });
  }

  const streamId = makeRunsStreamId(config);
  const event = cognateEvent(
    "cognate.run.preregistered",
    preRegistration.approvedBy,
    preRegistration.registeredAt,
    preRegistration.id,
    { ...preRegistration },
  );

  try {
    await config.eventStore.append(streamId, [event]);
  } catch (err) {
    throw new RegistryError({
      code: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The run pre-registration was not returned. The caller keeps the registry it passed in.",
    });
  }

  if (nextState !== undefined) {
    return nextState;
  }
  return {
    eventId: event.metadata.eventId,
    streamId,
    record: preRegistration,
  };
}

/**
 * Validate a {@link RunOutcome} (enforcing the hashed-identifier rule,
 * no-balance rule, and pre-registration linkage), record it in the registry
 * snapshot when provided, and append `cognate.run.completed` to
 * `cognate-${tenantId}-runs`.
 */
export async function attestRunCompleted(
  state: RegistryState,
  config: AttestRunConfig,
  outcome: RunOutcome,
): Promise<RegistryState>;
export async function attestRunCompleted(
  config: AttestRunConfig,
  outcome: RunOutcome,
  preRegistration: RunPreRegistration,
): Promise<AttestedRunEvent<RunOutcome>>;
export async function attestRunCompleted(
  stateOrConfig: RegistryState | AttestRunConfig,
  configOrOutcome: AttestRunConfig | RunOutcome,
  outcomeOrPreReg?: RunOutcome | RunPreRegistration,
): Promise<RegistryState | AttestedRunEvent<RunOutcome>> {
  const hasState = isRegistryState(stateOrConfig);
  const config = (hasState ? configOrOutcome : stateOrConfig) as AttestRunConfig;
  const outcome = (hasState ? outcomeOrPreReg : configOrOutcome) as RunOutcome;
  const explicitPreReg = hasState
    ? undefined
    : (outcomeOrPreReg as RunPreRegistration | undefined);

  if (!hasState && (!explicitPreReg || typeof explicitPreReg !== "object")) {
    throw new RegistryError({
      code: "PREREGISTRATION_NOT_FOUND",
      message: `Stateless attestRunCompleted for outcome "${outcome.id}" requires the RunPreRegistration it fulfills.`,
      hint: "Pass either a RegistryState containing the pre-registration or the explicit RunPreRegistration as the third argument.",
    });
  }

  const nextState = hasState
    ? recordRunOutcome(stateOrConfig, outcome)
    : (validateRunPreRegistration(explicitPreReg!),
      validateRunOutcome(outcome, explicitPreReg!),
      undefined);

  if (outcome.tenantId !== config.tenantId) {
    throw new RegistryError({
      code: "TENANT_MISMATCH",
      message: `Outcome tenant "${outcome.tenantId}" does not match config tenant "${config.tenantId}".`,
      hint: "Ensure the outcome tenantId matches the stream config tenantId.",
    });
  }

  const linkedPreReg = hasState
    ? getRunPreRegistration(stateOrConfig, outcome.preRegistrationId)
    : explicitPreReg;
  const actor = outcome.recordedBy ?? linkedPreReg?.approvedBy ?? outcome.tenantId;
  const streamId = makeRunsStreamId(config);
  const event = cognateEvent(
    "cognate.run.completed",
    actor,
    outcome.recordedAt,
    outcome.preRegistrationId,
    { ...outcome },
    outcome.preRegistrationId,
  );

  try {
    await config.eventStore.append(streamId, [event]);
  } catch (err) {
    throw new RegistryError({
      code: "attestia.append-failed",
      message: `Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "The run outcome was not returned. The caller keeps the registry it passed in.",
    });
  }

  if (nextState !== undefined) {
    return nextState;
  }
  return {
    eventId: event.metadata.eventId,
    streamId,
    record: outcome,
  };
}

/**
 * Build a Merkle tree over all transitions for a model version,
 * producing a cryptographic proof of lineage.
 */
export function buildTransitionProof(
  state: RegistryState,
  modelVersionId: string
): { root: string; count: number } | null {
  const transitions = state.transitions[modelVersionId];
  if (!transitions || transitions.length === 0) return null;

  const hashes = transitions.map((t) =>
    createHash("sha256")
      .update(
        JSON.stringify({
          modelVersionId: t.modelVersionId,
          from: t.from,
          to: t.to,
          actorId: t.actorId,
          reason: t.reason,
          timestamp: t.timestamp,
          // Only cited transitions carry this key, so the leaf of an uncited transition is unchanged.
          ...(t.evaluationIds !== undefined ? { evaluationIds: t.evaluationIds } : {}),
        }),
      )
      .digest("hex"),
  );

  const root = MerkleTree.build(hashes).getRoot();
  if (!root) return null;
  return { root, count: transitions.length };
}
