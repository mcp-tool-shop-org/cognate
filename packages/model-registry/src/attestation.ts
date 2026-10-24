/**
 * Attestia integration for the model registry.
 *
 * Wraps pure registry transitions with cryptographic event logging
 * and Merkle-tree hashing for version lineage proof.
 */

import { createHash, randomUUID } from "node:crypto";
import type { Evaluation, ModelVersionStatus } from "@cognate/types";
import type { DomainEvent, EventStore } from "@mcptoolshop/attestia/event-store";
import { MerkleTree } from "@mcptoolshop/attestia/proof";
import type { RegistryState, TransitionEvent, TransitionOptions } from "./types.js";
import { RegistryError } from "./types.js";
import { recordEvaluation, transitionVersion } from "./registry.js";

function cognateEvent(
  type: string,
  actor: string,
  timestamp: string,
  correlationId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    type,
    metadata: {
      eventId: randomUUID(),
      timestamp,
      actor,
      correlationId,
      source: "external",
    },
    payload,
  };
}

export interface AttestTransitionConfig {
  readonly eventStore: Pick<EventStore, "append">;
  readonly tenantId: string;
  readonly streamPrefix?: string;
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
