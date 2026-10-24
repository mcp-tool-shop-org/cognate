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
  /**
   * The evaluations this decision rests on, by id. Present only when the transition cited some, so a transition
   * without citations is recorded (and hashed) exactly as before.
   */
  readonly evaluationIds?: readonly string[];
}

/**
 * Options for a transition.
 */
export interface TransitionOptions {
  /** Evaluations recorded on this version that the decision rests on. Each must exist; the list must not be empty. */
  readonly evaluationIds?: readonly string[];
  /**
   * Which transitions must cite evaluations. Default `false`: none, so existing callers keep working.
   * - `"decisions"`: a move to `approved` or `rejected` must cite at least one evaluation.
   * - `"all"`: every transition must.
   */
  readonly requireEvaluationCitations?: RequireEvaluationCitations;
}

/** The citation rule for transitions; see {@link TransitionOptions.requireEvaluationCitations}. */
export type RequireEvaluationCitations = false | "decisions" | "all";

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
  /**
   * Evaluations per version id, in the order they were recorded. Optional so a snapshot saved before evaluations
   * existed still loads; read it with `getEvaluations`.
   */
  readonly evaluations?: Readonly<Record<string, readonly import("@cognate/types").Evaluation[]>>;
  /** Pre-registered runs by id. */
  readonly runPreRegistrations?: Readonly<
    Record<string, import("@cognate/types").RunPreRegistration>
  >;
  /** Recorded run outcomes by id. */
  readonly runOutcomes?: Readonly<Record<string, import("@cognate/types").RunOutcome>>;
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
