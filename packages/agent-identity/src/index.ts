/**
 * @cognate/agent-identity — Agent Identity and Capability Management
 *
 * Pure functions for registering agents, managing capability grants,
 * approvals, and revocations. Zero side effects.
 */

export type { IdentityRegistryState, IdentityError, IdentityResult } from "./types.js";
export {
  createRegistry,
  registerAgent,
  getAgent,
  requestGrant,
  approveGrant,
  rejectGrant,
  revokeCapability,
  getActiveCapabilities,
  isCapabilityActive,
  hasCapability,
  getGrantsForAgent,
} from "./identity.js";
