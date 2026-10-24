/**
 * @cognate/model-registry — Model Lifecycle State Machine
 *
 * Pure functions for model registration, versioning, lifecycle transitions,
 * and run pre-registration/outcome validation.
 * Attestia integration for cryptographic transition logging and Merkle proofs.
 */

export {
  createRegistry,
  registerModel,
  registerVersion,
  transitionVersion,
  getVersionHistory,
  getCurrentDeployedVersion,
  isSha256Hex,
  validateHashedIdentifiers,
  validateRunPreRegistration,
  validateRunOutcome,
  preRegisterRun,
  recordRunOutcome,
  getRunPreRegistration,
  getRunOutcomes,
} from "./registry.js";

export type { RegistryState, TransitionEvent } from "./types.js";
export { RegistryError } from "./types.js";

export type { AttestTransitionConfig } from "./attestation.js";
export {
  attestTransitionVersion,
  buildTransitionProof,
} from "./attestation.js";
