/**
 * @cognate/model-registry — Model Lifecycle State Machine
 *
 * Pure functions for model registration, versioning, and lifecycle transitions.
 * Attestia integration for cryptographic transition logging and Merkle proofs.
 */

export {
  createRegistry,
  registerModel,
  registerVersion,
  transitionVersion,
  recordEvaluation,
  getEvaluations,
  getVersionHistory,
  getCurrentDeployedVersion,
} from "./registry.js";

export type { RegistryState, RequireEvaluationCitations, TransitionEvent, TransitionOptions } from "./types.js";
export { RegistryError } from "./types.js";

export type { AttestTransitionConfig } from "./attestation.js";
export {
  attestEvaluation,
  attestTransitionVersion,
  buildTransitionProof,
} from "./attestation.js";
