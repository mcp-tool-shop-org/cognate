/**
 * Agent Identity Registry — pure functions, no side effects.
 *
 * Manages agent registration, capability grants, approvals, and revocations.
 * All state transitions return new immutable RegistryState objects.
 */

import type { ActorId, Agent, Capability, CapabilityGrant, HashId, Timestamp } from "@cognate/types";
import type { IdentityError, IdentityRegistryState, IdentityResult } from "./types.js";

function err(code: string, message: string, hint: string): IdentityError {
  return { code, message, hint };
}

function ok<T>(value: T, state: IdentityRegistryState): IdentityResult<T> {
  return { ok: true, value, state };
}

function fail<T>(error: IdentityError, state: IdentityRegistryState): IdentityResult<T> {
  return { ok: false, error, state };
}

/** Create an empty identity registry. */
export function createRegistry(): IdentityRegistryState {
  return { agents: new Map(), grants: new Map() };
}

/** Register an agent. Fails if agent ID already exists. */
export function registerAgent(
  state: IdentityRegistryState,
  agent: Agent
): IdentityResult<void> {
  if (state.agents.has(agent.id)) {
    return fail(err("identity.duplicate", `Agent ${agent.id} already registered`, "Use updateAgent to modify an existing agent."), state);
  }
  const newAgents = new Map(state.agents);
  newAgents.set(agent.id, agent);
  return ok(undefined, { ...state, agents: newAgents });
}

/** Retrieve an agent by ID. */
export function getAgent(
  state: IdentityRegistryState,
  agentId: ActorId
): Agent | undefined {
  return state.agents.get(agentId);
}

/** Submit a capability grant request (status: pending). */
export function requestGrant(
  state: IdentityRegistryState,
  grant: CapabilityGrant
): IdentityResult<void> {
  if (!state.agents.has(grant.agentId)) {
    return fail(err("identity.agent-not-found", `Agent ${grant.agentId} not found`, "Register the agent before requesting a grant."), state);
  }
  if (state.grants.has(grant.id)) {
    return fail(err("identity.duplicate-grant", `Grant ${grant.id} already exists`, "Each grant must have a unique ID."), state);
  }
  const newGrants = new Map(state.grants);
  newGrants.set(grant.id, grant);
  return ok(undefined, { ...state, grants: newGrants });
}

/** Approve a pending capability grant. */
export function approveGrant(
  state: IdentityRegistryState,
  grantId: HashId,
  approverId: ActorId,
  timestamp: Timestamp
): IdentityResult<void> {
  const grant = state.grants.get(grantId);
  if (!grant) {
    return fail(err("identity.grant-not-found", `Grant ${grantId} not found`, "Check the grant ID and try again."), state);
  }
  if (grant.status !== "pending") {
    return fail(err("identity.grant-not-pending", `Grant ${grantId} is ${grant.status}, not pending`, "Only pending grants can be approved."), state);
  }
  const newGrants = new Map(state.grants);
  newGrants.set(grantId, { ...grant, status: "approved" as const, approvedBy: approverId, approvedAt: timestamp });

  // Also append capability to agent
  const agent = state.agents.get(grant.agentId);
  if (agent) {
    const newAgents = new Map(state.agents);
    newAgents.set(grant.agentId, { ...agent, capabilities: [...agent.capabilities, grant.capability] });
    return ok(undefined, { agents: newAgents, grants: newGrants });
  }
  return ok(undefined, { ...state, grants: newGrants });
}

/** Reject a pending capability grant. */
export function rejectGrant(
  state: IdentityRegistryState,
  grantId: HashId,
  approverId: ActorId,
  timestamp: Timestamp
): IdentityResult<void> {
  const grant = state.grants.get(grantId);
  if (!grant) {
    return fail(err("identity.grant-not-found", `Grant ${grantId} not found`, "Check the grant ID and try again."), state);
  }
  if (grant.status !== "pending") {
    return fail(err("identity.grant-not-pending", `Grant ${grantId} is ${grant.status}, not pending`, "Only pending grants can be rejected."), state);
  }
  const newGrants = new Map(state.grants);
  newGrants.set(grantId, { ...grant, status: "rejected" as const, approvedBy: approverId, approvedAt: timestamp });
  return ok(undefined, { ...state, grants: newGrants });
}

/** Revoke an approved capability. */
export function revokeCapability(
  state: IdentityRegistryState,
  agentId: ActorId,
  capabilityId: HashId,
  revokerId: ActorId,
  timestamp: Timestamp
): IdentityResult<void> {
  const agent = state.agents.get(agentId);
  if (!agent) {
    return fail(err("identity.agent-not-found", `Agent ${agentId} not found`, "Register the agent before revoking capabilities."), state);
  }
  const hasCap = agent.capabilities.some((c) => c.id === capabilityId);
  if (!hasCap) {
    return fail(err("identity.capability-not-found", `Capability ${capabilityId} not found on agent ${agentId}`, "Check the capability ID."), state);
  }
  const newAgents = new Map(state.agents);
  newAgents.set(agentId, {
    ...agent,
    capabilities: agent.capabilities.filter((c) => c.id !== capabilityId),
  });
  return ok(undefined, { ...state, agents: newAgents });
}

/** Get active capabilities for an agent at a given timestamp. */
export function getActiveCapabilities(
  state: IdentityRegistryState,
  agentId: ActorId,
  atTimestamp: Timestamp
): readonly Capability[] {
  const agent = state.agents.get(agentId);
  if (!agent) return [];
  return agent.capabilities.filter((c) => isCapabilityActive(c, atTimestamp));
}

/** Check if a capability is active at a given timestamp. */
export function isCapabilityActive(
  capability: Capability,
  atTimestamp: Timestamp
): boolean {
  if (capability.expiresAt === null) return true;
  return atTimestamp < capability.expiresAt;
}

/** Check if an agent has a specific capability kind. */
export function hasCapability(
  state: IdentityRegistryState,
  agentId: ActorId,
  kind: Capability["kind"],
  atTimestamp: Timestamp
): boolean {
  return getActiveCapabilities(state, agentId, atTimestamp).some((c) => c.kind === kind);
}

/** Get all grants for an agent. */
export function getGrantsForAgent(
  state: IdentityRegistryState,
  agentId: ActorId
): readonly CapabilityGrant[] {
  return Array.from(state.grants.values()).filter((g) => g.agentId === agentId);
}
