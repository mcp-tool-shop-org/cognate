/**
 * Agent Identity Registry — pure functions, no side effects.
 *
 * Manages agent registration, capability grants, approvals, and revocations.
 * All state transitions return new immutable RegistryState objects.
 */

import { createHash } from "node:crypto";
import type { ActorId, Agent, Capability, CapabilityGrant, HashId, Timestamp } from "@cognate/types";
import type { IdentityError, IdentityRegistryState, IdentityResult } from "./types.js";

const RAW_PUBLIC_KEY_B64URL_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Derive the 64-character lowercase hex SHA-256 key identifier (`kid`) from a
 * base64url-encoded raw 32-byte Ed25519 public key, or return `null` if invalid.
 */
export function deriveKeyIdFromPublicKey(publicKey: string): string | null {
  if (!RAW_PUBLIC_KEY_B64URL_RE.test(publicKey)) {
    return null;
  }
  const raw = Buffer.from(publicKey, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== publicKey) {
    return null;
  }
  return createHash("sha256").update(raw).digest("hex");
}

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

/** Register an agent. Fails if agent ID already exists or publicKey is malformed. */
export function registerAgent(
  state: IdentityRegistryState,
  agent: Agent
): IdentityResult<void> {
  if (state.agents.has(agent.id)) {
    return fail(err("identity.duplicate", `Agent ${agent.id} already registered`, "Use updateAgent to modify an existing agent."), state);
  }
  let derivedKid: string | null = null;
  if (agent.publicKey !== null) {
    derivedKid = deriveKeyIdFromPublicKey(agent.publicKey);
    if (derivedKid === null) {
      return fail(
        err(
          "identity.invalid-public-key",
          `Agent ${agent.id} has an invalid Ed25519 publicKey`,
          "Provide a 43-character base64url raw 32-byte Ed25519 public key.",
        ),
        state,
      );
    }
    if (agent.kid !== undefined && agent.kid !== null && agent.kid !== derivedKid) {
      return fail(
        err(
          "identity.kid-mismatch",
          `Agent ${agent.id} kid does not match sha256(publicKey)`,
          "Omit kid or set it to the lowercase hex SHA-256 of the raw 32-byte public key.",
        ),
        state,
      );
    }
  }
  const normalizedAgent: Agent = {
    ...agent,
    ...(derivedKid !== null ? { kid: derivedKid } : {}),
  };
  const newAgents = new Map(state.agents);
  newAgents.set(agent.id, normalizedAgent);
  return ok(undefined, { ...state, agents: newAgents });
}

/** Retrieve an agent by ID. */
export function getAgent(
  state: IdentityRegistryState,
  agentId: ActorId
): Agent | undefined {
  return state.agents.get(agentId);
}

/** Submit a capability grant request (status: pending, approvedBy: null). */
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
  if (grant.status !== "pending" || grant.approvedBy !== null || (grant.approvedAt !== null && grant.approvedAt !== undefined)) {
    return fail(
      err(
        "identity.grant-not-pending",
        `New grant ${grant.id} must have status "pending" and approvedBy null`,
        "Submit new grants with status: 'pending', approvedBy: null, and approvedAt: null.",
      ),
      state,
    );
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
  if (approverId === grant.agentId) {
    return fail(
      err(
        "auth.self-approval-forbidden",
        `Principal ${approverId} cannot approve a grant for itself`,
        "Have another authorized delegate approve the grant.",
      ),
      state,
    );
  }
  const approvedCapability: Capability = {
    ...grant.capability,
    grantedBy: approverId,
  };
  const newGrants = new Map(state.grants);
  newGrants.set(grantId, {
    ...grant,
    capability: approvedCapability,
    status: "approved" as const,
    approvedBy: approverId,
    approvedAt: timestamp,
  });

  // Also append capability to agent
  const agent = state.agents.get(grant.agentId);
  if (agent) {
    const newAgents = new Map(state.agents);
    newAgents.set(grant.agentId, { ...agent, capabilities: [...agent.capabilities, approvedCapability] });
    return ok(undefined, { agents: newAgents, grants: newGrants });
  }
  return ok(undefined, { ...state, grants: newGrants });
}

/** Rotate an active agent's Ed25519 public key and record the previous kid as revoked. */
export function rotateAgentKey(
  state: IdentityRegistryState,
  agentId: ActorId,
  newPublicKey: string,
): IdentityResult<Agent> {
  const agent = state.agents.get(agentId);
  if (!agent) {
    return fail(err("identity.agent-not-found", `Agent ${agentId} not found`, "Register the agent before rotating its key."), state);
  }
  if (agent.status !== "active") {
    return fail(err("identity.agent-not-active", `Agent ${agentId} is ${agent.status}, not active`, "Only active agents can rotate keys."), state);
  }
  const newKid = deriveKeyIdFromPublicKey(newPublicKey);
  if (newKid === null) {
    return fail(err("identity.invalid-public-key", "Invalid Ed25519 publicKey", "Provide a 43-character base64url raw 32-byte Ed25519 public key."), state);
  }
  const currentKid = agent.kid ?? (agent.publicKey ? deriveKeyIdFromPublicKey(agent.publicKey) : null);
  const existingRevoked = agent.revokedKids ?? [];
  if (newKid === currentKid || existingRevoked.includes(newKid)) {
    return fail(err("identity.key-already-used", `Key ${newKid} is already active or previously revoked on agent ${agentId}`, "Generate a fresh Ed25519 key pair."), state);
  }
  const revokedKids = currentKid ? [...existingRevoked, currentKid] : [...existingRevoked];
  const updatedAgent: Agent = {
    ...agent,
    publicKey: newPublicKey,
    kid: newKid,
    revokedKids,
  };
  const newAgents = new Map(state.agents);
  newAgents.set(agentId, updatedAgent);
  return ok(updatedAgent, { ...state, agents: newAgents });
}

/** Revoke an agent and its active key. */
export function revokeAgent(
  state: IdentityRegistryState,
  agentId: ActorId,
): IdentityResult<Agent> {
  const agent = state.agents.get(agentId);
  if (!agent) {
    return fail(err("identity.agent-not-found", `Agent ${agentId} not found`, "Check the agent ID."), state);
  }
  const currentKid = agent.kid ?? (agent.publicKey ? deriveKeyIdFromPublicKey(agent.publicKey) : null);
  const existingRevoked = agent.revokedKids ?? [];
  const revokedKids =
    currentKid && !existingRevoked.includes(currentKid)
      ? [...existingRevoked, currentKid]
      : [...existingRevoked];
  const updatedAgent: Agent = {
    ...agent,
    status: "revoked",
    publicKey: null,
    kid: null,
    revokedKids,
  };
  const newAgents = new Map(state.agents);
  newAgents.set(agentId, updatedAgent);
  return ok(updatedAgent, { ...state, agents: newAgents });
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
  _revokerId: ActorId,
  _timestamp: Timestamp
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
