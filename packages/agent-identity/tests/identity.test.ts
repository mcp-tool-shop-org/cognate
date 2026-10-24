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
  deriveKeyIdFromPublicKey,
  rotateAgentKey,
  revokeAgent,
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

  it('fails to reject non-existent grant', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const result = rejectGrant(state, 'grant-1', 'admin-1', later);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.grant-not-found');
  });

  it('fails to reject already-rejected grant', () => {
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
    const result = rejectGrant(state, 'grant-1', 'admin-1', later);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.grant-not-pending');
  });

  it('fails to revoke capability for unknown agent', () => {
    const state = createRegistry();
    const result = revokeCapability(state, 'agent-1', 'cap-1', 'admin-1', later);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.agent-not-found');
  });

  it('fails to revoke non-existent capability', () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const result = revokeCapability(state, 'agent-1', 'cap-1', 'admin-1', later);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('identity.capability-not-found');
  });

  it('validates Ed25519 publicKey and derives kid on registerAgent', () => {
    const validKey1 = 'OU0e1p_4rG9FqAHKkPob3VddG3eBEbRs55JR2wL5TIM';
    const expectedKid1 = '6e676438555d5783c9197c1ad0f7ffd21d30c017f3bc882014c90756d91224e3';
    expect(deriveKeyIdFromPublicKey(validKey1)).toBe(expectedKid1);
    expect(deriveKeyIdFromPublicKey('short')).toBeNull();

    let state = createRegistry();
    const badKey = registerAgent(state, { ...baseAgent, publicKey: 'not-a-valid-key' });
    expect(badKey.ok).toBe(false);
    if (!badKey.ok) expect(badKey.error.code).toBe('identity.invalid-public-key');

    const mismatchKid = registerAgent(state, { ...baseAgent, publicKey: validKey1, kid: '0'.repeat(64) });
    expect(mismatchKid.ok).toBe(false);
    if (!mismatchKid.ok) expect(mismatchKid.error.code).toBe('identity.kid-mismatch');

    const okReg = registerAgent(state, { ...baseAgent, publicKey: validKey1 });
    expect(okReg.ok).toBe(true);
    expect(getAgent(okReg.state, 'agent-1')?.kid).toBe(expectedKid1);
  });

  it('refuses duplicate grants, pre-approved grants, missing grants, and self-approval', () => {
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

    const dup = requestGrant(state, grant);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('identity.duplicate-grant');

    const preApproved = requestGrant(state, {
      ...grant,
      id: 'grant-pre',
      status: 'approved',
      approvedBy: 'admin-1',
      approvedAt: now,
    });
    expect(preApproved.ok).toBe(false);
    if (!preApproved.ok) expect(preApproved.error.code).toBe('identity.grant-not-pending');

    const missingApprove = approveGrant(state, 'grant-missing', 'admin-1', later);
    expect(missingApprove.ok).toBe(false);
    if (!missingApprove.ok) expect(missingApprove.error.code).toBe('identity.grant-not-found');

    const selfApprove = approveGrant(state, 'grant-1', 'agent-1', later);
    expect(selfApprove.ok).toBe(false);
    if (!selfApprove.ok) expect(selfApprove.error.code).toBe('auth.self-approval-forbidden');
  });

  it('rotates and revokes agent keys', () => {
    const key1 = 'OU0e1p_4rG9FqAHKkPob3VddG3eBEbRs55JR2wL5TIM';
    const kid1 = '6e676438555d5783c9197c1ad0f7ffd21d30c017f3bc882014c90756d91224e3';
    const key2 = 'Ts-MTztMri3vSZwiT87kz0E0CduYsTBJUxA590z8rf8';
    const kid2 = 'e86478cb0dda167def172760eb69c635497dd3cfe3bc9849388f96ffdc6804f7';

    let state = createRegistry();
    expect(rotateAgentKey(state, 'missing', key1).ok).toBe(false);
    expect(revokeAgent(state, 'missing').ok).toBe(false);

    state = registerAgent(state, { ...baseAgent, publicKey: key1 }).state;

    const badNewKey = rotateAgentKey(state, 'agent-1', 'bad-key');
    expect(badNewKey.ok).toBe(false);
    if (!badNewKey.ok) expect(badNewKey.error.code).toBe('identity.invalid-public-key');

    const sameKey = rotateAgentKey(state, 'agent-1', key1);
    expect(sameKey.ok).toBe(false);
    if (!sameKey.ok) expect(sameKey.error.code).toBe('identity.key-already-used');

    const rotated = rotateAgentKey(state, 'agent-1', key2);
    expect(rotated.ok).toBe(true);
    state = rotated.state;
    expect(getAgent(state, 'agent-1')?.kid).toBe(kid2);
    expect(getAgent(state, 'agent-1')?.revokedKids).toEqual([kid1]);

    const reusedRevoked = rotateAgentKey(state, 'agent-1', key1);
    expect(reusedRevoked.ok).toBe(false);
    if (!reusedRevoked.ok) expect(reusedRevoked.error.code).toBe('identity.key-already-used');

    const revoked = revokeAgent(state, 'agent-1');
    expect(revoked.ok).toBe(true);
    state = revoked.state;
    expect(getAgent(state, 'agent-1')?.status).toBe('revoked');
    expect(getAgent(state, 'agent-1')?.publicKey).toBeNull();
    expect(getAgent(state, 'agent-1')?.revokedKids).toEqual([kid1, kid2]);

    const rotateAfterRevoke = rotateAgentKey(state, 'agent-1', key1);
    expect(rotateAfterRevoke.ok).toBe(false);
    if (!rotateAfterRevoke.ok) expect(rotateAfterRevoke.error.code).toBe('identity.agent-not-active');
  });
