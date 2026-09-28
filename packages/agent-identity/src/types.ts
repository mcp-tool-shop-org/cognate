/**
 * Agent identity registry types — pure, serializable, zero side effects.
 */

import type { ActorId, Agent, CapabilityGrant, HashId } from "@cognate/types";

export interface IdentityRegistryState {
  readonly agents: ReadonlyMap<ActorId, Agent>;
  readonly grants: ReadonlyMap<HashId, CapabilityGrant>;
}

export interface IdentityError {
  readonly code: string;
  readonly message: string;
  readonly hint: string;
}

export type IdentityResult<T> =
  | { readonly ok: true; readonly value: T; readonly state: IdentityRegistryState }
  | { readonly ok: false; readonly error: IdentityError; readonly state: IdentityRegistryState };
