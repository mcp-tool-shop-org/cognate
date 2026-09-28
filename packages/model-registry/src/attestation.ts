/**
 * Attestia integration for the model registry.
 *
 * Wraps pure registry transitions with cryptographic event logging
 * and Merkle-tree hashing for version lineage proof.
 */

import { createHash } from "node:crypto";
import type { ModelVersionStatus } from "@cognate/types";
import type { RegistryState, TransitionEvent } from "./types.js";
import { RegistryError } from "./types.js";
import { transitionVersion } from "./registry.js";
// Attestia's published proof types do not currently name MerkleTree.
// @ts-ignore — runtime export is MerkleTree.build / getRoot
import { MerkleTree } from "@mcptoolshop/attestia/proof";

// Local interface matching Attestia's EventStore shape
interface EventStore {
  append(streamId: string, events: unknown | unknown[], options?: unknown): Promise<unknown>;
}

export interface AttestTransitionConfig {
  readonly eventStore: EventStore;
  readonly tenantId: string;
  readonly streamPrefix?: string;
}

function makeStreamId(config: AttestTransitionConfig): string {
  return `${config.streamPrefix ?? "cognate"}-${config.tenantId}-transitions`;
}

/**
 * Transition a model version AND append a cryptographic event to Attestia.
 *
 * The transition is first applied to the registry, then a
 * "cognate.model.transitioned" event is appended to the EventStore.
 * If the EventStore append fails, the registry state is NOT rolled back;
 * callers should reconcile the inconsistency.
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
      {
        type: "cognate.model.transitioned",
        payload: {
          modelVersionId: event.modelVersionId,
          from: event.from,
          to: event.to,
          actorId: event.actorId,
          reason: event.reason,
          timestamp: event.timestamp,
        },
        timestamp: event.timestamp,
      }
    );
  } catch (err) {
    throw new RegistryError({
      code: "attestia.append-failed",
      message: `Transition applied locally but Attestia append failed: ${err instanceof Error ? err.message : String(err)}`,
      hint: "Check EventStore connectivity. The local state and Attestia may be inconsistent.",
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
        }),
      )
      .digest("hex"),
  );

  const root = MerkleTree.build(hashes).getRoot();
  if (!root) return null;
  return { root, count: transitions.length };
}
