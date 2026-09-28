/**
 * Registry-specific types for the model lifecycle state machine.
 */

import type { ModelVersionStatus } from "@cognate/types";

/**
 * A recorded state transition for a model version.
 */
export interface TransitionEvent {
  /** The version that transitioned. */
  readonly modelVersionId: string;
  /** The previous state. */
  readonly from: ModelVersionStatus;
  /** The new state. */
  readonly to: ModelVersionStatus;
  /** Who authorized the transition. */
  readonly actorId: string;
  /** Why the transition occurred. */
  readonly reason: string;
  /** ISO 8601 timestamp of the transition. */
  readonly timestamp: string;
}

/**
 * Immutable snapshot of the model registry.
 */
export interface RegistryState {
  /** All registered models by id. */
  readonly models: Readonly<Record<string, import("@cognate/types").Model>>;
  /** All registered versions by id. */
  readonly versions: Readonly<Record<string, import("@cognate/types").ModelVersion>>;
  /** Transition history per version id. */
  readonly transitions: Readonly<Record<string, readonly TransitionEvent[]>>;
}

/**
 * Structured error thrown by the registry.
 *
 * Follows the Attestia error envelope shape: `{ code, message, hint }`.
 */
export class RegistryError extends Error {
  /** Stable machine-readable error code. */
  readonly code: string;

  /** Actionable hint for resolving the error. */
  readonly hint: string;

  constructor(args: { code: string; message: string; hint: string }) {
    super(args.message);
    this.name = "RegistryError";
    this.code = args.code;
    this.hint = args.hint;
  }
}
