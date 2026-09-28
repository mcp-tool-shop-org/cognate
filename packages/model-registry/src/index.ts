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
  getVersionHistory,
  getCurrentDeployedVersion,
} from "./registry.js";

export type { RegistryState, TransitionEvent } from "./types.js";
export { RegistryError } from "./types.js";

export type { AttestTransitionConfig } from "./attestation.js";
export {
  attestTransitionVersion,
  buildTransitionProof,
} from "./attestation.js";
