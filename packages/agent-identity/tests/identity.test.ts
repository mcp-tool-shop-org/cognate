import { describe, expect, it } from 'vitest';
import {
  createRegistry,
  registerAgent,
  getAgent,
  requestGrant,
  approveGrant,
  rejectGrant,
  revokeCapability,
  getActiveCapabilities,
  hasCapability,
  getGrantsForAgent,
} from '../src/identity.js';

const now = '2026-09-28T12:00:00.000Z';
const later = '2026-09-29T12:00:00.000Z';

const baseAgent = {
  id: 'agent-1',
  tenantId: 'tenant-1',
  name: 'Test Agent',
  owner: 'human-1',
  walletAddress: null,
  publicKey: null,
  capabilities: [],
  createdAt: now,
  status: 'active' as const,
};

const baseCapability = {
  id: 'cap-1',
  kind: 'inference' as const,
  scope: { kind: 'unlimited' } as const,
  constraints: [],
  grantedAt: now,
  grantedBy: 'human-1',
  expiresAt: null,
};

describe('agent-identity', () => {
  it('creates an empty registry', () => {
    const state = createRegistry();
    expect(state.agents.size).toBe(0);
    expect(state.grants.size).toBe(0);
  });

  it('registers an agent', () => {
    let state = createRegistry();
    const result = registerAgent(state, baseAgent);
    expect(result.ok).toBe(true);
    expect(result.state.agents.size).toBe(1);
    expect(getAgent(result.state, 'agent-1')).toEqual(baseAgent);
  });

  it('fails to register duplicate agent', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const result = registerAgent(state, baseAgent);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.duplicate');
  });

  it('submits a capability grant request', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    const result = requestGrant(state, grant);
    expect(result.ok).toBe(true);
    expect(result.state.grants.size).toBe(1);
  });

  it('fails to grant for unknown agent', () => {
    const state = createRegistry();
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    const result = requestGrant(state, grant);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.agent-not-found');
  });

  it('approves a pending grant and adds capability to agent', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    const result = approveGrant(state, 'grant-1', 'admin-1', later);
    expect(result.ok).toBe(true);
    expect(getAgent(result.state, 'agent-1')?.capabilities).toHaveLength(1);
  });

  it('rejects a pending grant', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    const result = rejectGrant(state, 'grant-1', 'admin-1', later);
    expect(result.ok).toBe(true);
    expect(getAgent(result.state, 'agent-1')?.capabilities).toHaveLength(0);
  });

  it('fails to approve non-pending grant', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    state = rejectGrant(state, 'grant-1', 'admin-1', later).state;
    const result = approveGrant(state, 'grant-1', 'admin-1', later);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.grant-not-pending');
  });

  it('revokes a capability', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    state = approveGrant(state, 'grant-1', 'admin-1', later).state;
    const result = revokeCapability(state, 'agent-1', 'cap-1', 'admin-1', later);
    expect(result.ok).toBe(true);
    expect(getAgent(result.state, 'agent-1')?.capabilities).toHaveLength(0);
  });

  it('checks capability active status with expiry', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const expCap = { ...baseCapability, id: 'cap-2', expiresAt: '2026-09-28T13:00:00.000Z' };
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: expCap,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    state = approveGrant(state, 'grant-1', 'admin-1', later).state;
    const caps = getActiveCapabilities(state, 'agent-1', '2026-09-28T12:30:00.000Z');
    expect(caps).toHaveLength(1);
    const capsExpired = getActiveCapabilities(state, 'agent-1', '2026-09-28T14:00:00.000Z');
    expect(capsExpired).toHaveLength(0);
  });

  it('hasCapability returns true when active', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    state = approveGrant(state, 'grant-1', 'admin-1', later).state;
    expect(hasCapability(state, 'agent-1', 'inference', later)).toBe(true);
    expect(hasCapability(state, 'agent-1', 'spend', later)).toBe(false);
  });

  it('gets grants for an agent', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: 'grant-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      capability: baseCapability,
      requestedBy: 'human-1',
      requestedAt: now,
      status: 'pending' as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    expect(getGrantsForAgent(state, 'agent-1')).toHaveLength(1);
    expect(getGrantsForAgent(state, 'agent-2')).toHaveLength(0);
  });
});
