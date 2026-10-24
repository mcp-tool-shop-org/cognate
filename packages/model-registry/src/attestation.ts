/**
 * Attestia integration for the model registry.
 *
 * Wraps pure registry transitions with cryptographic event logging
 * and Merkle-tree hashing for version lineage proof.
 */

import { createHash, randomUUID } from "node:crypto";
import type { ModelVersionStatus, RunOutcome, RunPreRegistration } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import { MerkleTree } from "@mcptoolshop/attestia/proof";
import type { RegistryState, TransitionEvent } from "./types.js";
import { RegistryError } from "./types.js";
import { getRunPreRegistration, preRegisterRun, recordRunOutcome, transitionVersion, validateRunOutcome, validateRunPreRegistration } from "./registry.js";

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

function makeStreamId(config: AttestTransitionConfig): string {
  return `${config.streamPrefix ?? "cognate"}-${config.tenantId}-transitions`;
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
  reason: string
): Promise<RegistryState> {
  const newState = transitionVersion(state, modelVersionId, from, to, actorId, reason);

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
        }),
      )
      .digest("hex"),
  );

  const root = MerkleTree.build(hashes).getRoot();
  if (!root) return null;
  return { root, count: transitions.length };
}
