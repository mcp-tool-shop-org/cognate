/**
 * Inclusion proof for one recorded governance event.
 *
 * The tree is the whole log in global position order. Sibling hashes can
 * belong to another tenant. The event body of another tenant is not returned.
 */

import type { StoredEvent } from "@mcptoolshop/attestia/event-store";
import { hashAttestation, MerkleTree, type MerkleProof } from "@mcptoolshop/attestia/proof";

const STREAM_SUFFIXES = ["policy", "transitions", "prompts", "outputs", "releases"] as const;
const PLAINTEXT_KEYS = ["plaintext", "promptText", "outputText"] as const;

export interface RecordedEvent {
  readonly type: string;
  readonly metadata: StoredEvent["event"]["metadata"];
  readonly payload: Record<string, unknown>;
}

export type ProofFailureCode =
  | "attestia.event-not-found"
  | "attestia.event-ambiguous"
  | "attestia.event-withheld"
  | "attestia.proof-failed";

export type ProofResult =
  | {
      readonly ok: true;
      readonly event: RecordedEvent;
      readonly proof: MerkleProof;
      readonly root: string;
      readonly leafCount: number;
    }
  | { readonly ok: false; readonly code: ProofFailureCode };

const PROOF_ERRORS: Record<ProofFailureCode, { message: string; hint: string }> = {
  "attestia.event-not-found": {
    message: "No event with that id is in the log.",
    hint: "The id is the eventId from a governance response for this tenant.",
  },
  "attestia.event-ambiguous": {
    message: "That id is on more than one event.",
    hint: "The log was not proved.",
  },
  "attestia.event-withheld": {
    message: "The recorded event holds prompt or output text.",
    hint: "The event was not returned.",
  },
  "attestia.proof-failed": {
    message: "Attestia did not produce an inclusion proof for that event.",
    hint: "The event was not returned.",
  },
};

export function proofErrorBody(code: ProofFailureCode): { code: ProofFailureCode; message: string; hint: string } {
  return { code, ...PROOF_ERRORS[code] };
}

export function statusForProof(code: ProofFailureCode): number {
  if (code === "attestia.event-not-found") return 404;
  if (code === "attestia.event-ambiguous") return 409;
  return 503;
}

export function eventVisibleToTenant(streamId: string, tenantId: string): boolean {
  return STREAM_SUFFIXES.some((suffix) => streamId === `cognate-${tenantId}-${suffix}`);
}

function attestedEvent(stored: StoredEvent): RecordedEvent {
  const payload = stored.event.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("event payload is not an object");
  }
  return {
    type: stored.event.type,
    metadata: stored.event.metadata,
    payload,
  };
}

function holdsPlaintext(payload: Record<string, unknown>): boolean {
  return PLAINTEXT_KEYS.some((key) => key in payload);
}

/**
 * Prove `eventId` against `events` as Attestia stored them.
 * Leaves are `hashAttestation` of `{ type, metadata, payload }`.
 */
export function proveRecordedEvent(
  events: readonly StoredEvent[],
  eventId: string,
  tenantId: string,
): ProofResult {
  const sorted = [...events].sort((a, b) => a.globalPosition - b.globalPosition);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]?.globalPosition !== i + 1) {
      return { ok: false, code: "attestia.proof-failed" };
    }
  }

  const matches = sorted.filter((stored) => stored.event.metadata.eventId === eventId);
  if (matches.length > 1) return { ok: false, code: "attestia.event-ambiguous" };
  const stored = matches[0];
  if (!stored || !eventVisibleToTenant(stored.streamId, tenantId)) {
    return { ok: false, code: "attestia.event-not-found" };
  }

  try {
    const attested = sorted.map((item) => attestedEvent(item));
    const index = sorted.indexOf(stored);
    const event = attested[index];
    if (!event) return { ok: false, code: "attestia.proof-failed" };
    if (holdsPlaintext(event.payload)) return { ok: false, code: "attestia.event-withheld" };

    const leaves = attested.map((item) => hashAttestation(item));
    const tree = MerkleTree.build(leaves);
    const proof = tree.getProof(index);
    const root = tree.getRoot();
    if (
      !proof ||
      !root ||
      proof.leafHash !== leaves[index] ||
      proof.root !== root ||
      !MerkleTree.verifyProof(proof)
    ) {
      return { ok: false, code: "attestia.proof-failed" };
    }
    return { ok: true, event, proof, root, leafCount: leaves.length };
  } catch {
    return { ok: false, code: "attestia.proof-failed" };
  }
}
