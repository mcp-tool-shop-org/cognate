/**
 * @cognate/agent-identity — Agent Identity and Capability Management
 *
 * Pure functions for registering agents, managing capability grants,
 * approvals, and revocations. Zero side effects.
 */

export type { IdentityRegistryState, IdentityState, IdentityError, IdentityResult } from "./types.js";
export type {
  VerifiableCredential,
  DataIntegrityProof,
  VCExportOptions,
  VCExportResult,
  CognateCapabilityGrantSubject,
} from "./vc-types.js";
export {
  createRegistry,
  deriveKeyIdFromPublicKey,
  registerAgent,
  getAgent,
  requestGrant,
  approveGrant,
  rejectGrant,
  revokeCapability,
  rotateAgentKey,
  revokeAgent,
  getActiveCapabilities,
  isCapabilityActive,
  hasCapability,
  getGrantsForAgent,
} from "./identity.js";
export {
  exportGrantAsVC,
  attachProof,
  verifyProofStructure,
  canonicalizeCredential,
  hashCanonical,
} from "./vc-export.js";
