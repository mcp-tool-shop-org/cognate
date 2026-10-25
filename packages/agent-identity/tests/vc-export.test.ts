import { describe, expect, it } from "vitest";
import {
  createRegistry,
  registerAgent,
  requestGrant,
  approveGrant,
} from "../src/identity.js";
import {
  exportGrantAsVC,
  attachProof,
  verifyProofStructure,
  canonicalizeCredential,
  hashCanonical,
} from "../src/vc-export.js";

const now = "2026-09-28T12:00:00.000Z";

const baseAgent = {
  id: "agent-1",
  tenantId: "tenant-1",
  name: "Test Agent",
  owner: "human-1",
  walletAddress: null,
  publicKey: null,
  capabilities: [],
  createdAt: now,
  status: "active" as const,
};

const baseCapability = {
  id: "cap-1",
  kind: "inference" as const,
  scope: { kind: "unlimited" } as const,
  constraints: [],
  grantedAt: now,
  grantedBy: "human-1",
  expiresAt: null,
};

function setupApprovedGrant() {
  let state = createRegistry();
  state = registerAgent(state, baseAgent).state;
  const grant = {
    id: "grant-1",
    tenantId: "tenant-1",
    agentId: "agent-1",
    capability: baseCapability,
    requestedBy: "human-1",
    requestedAt: now,
    status: "pending" as const,
    approvedBy: null,
    approvedAt: null,
  };
  state = requestGrant(state, grant).state;
  state = approveGrant(state, "grant-1", "admin-1", now).state;
  return state;
}

describe("vc-export", () => {
  it("exports an approved grant as an unsigned VC", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "mcp-tool-shop-org/cognate",
      issuerName: "Cognate Governance",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { credential, canonicalHash } = result.value;

    // W3C VC 2.0 structure
    expect(credential["@context"]).toContain("https://www.w3.org/2018/credentials/v2");
    expect(credential["@context"]).toContain("https://cognate.dev/vc/v1");
    expect(credential.type).toContain("VerifiableCredential");
    expect(credential.type).toContain("CognateCapabilityGrant");
    expect(credential.id).toBe("urn:cognate:grant:grant-1");
    expect(credential.issuer.id).toBe("mcp-tool-shop-org/cognate");
    expect(credential.issuer.name).toBe("Cognate Governance");
    expect(credential.validFrom).toBe(now);

    // Cognate extension in credentialSubject
    expect(credential.credentialSubject.id).toBe("urn:cognate:agent:agent-1");
    expect(credential.credentialSubject.type).toBe("AIAgent");
    expect(credential.credentialSubject.cognateCapabilityGrant).toBeDefined();
    expect(credential.credentialSubject.cognateCapabilityGrant?.grantId).toBe("grant-1");
    expect(credential.credentialSubject.cognateCapabilityGrant?.approvedBy).toBe("admin-1");
    expect(credential.credentialSubject.cognateCapabilityGrant?.capabilityKind).toBe("inference");

    // No proof yet
    expect("proof" in credential).toBe(false);

    // Canonical hash is a 64-char hex SHA-256
    expect(canonicalHash).toHaveLength(64);
    expect(canonicalHash).toMatch(/^[0-9a-f]+$/);
  });

  it("uses custom credentialId when provided", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "org/example",
      credentialId: "urn:uuid:custom-123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.credential.id).toBe("urn:uuid:custom-123");
  });

  it("fails to export a non-existent grant", () => {
    const state = createRegistry();
    const result = exportGrantAsVC(state, "missing-grant", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("vc.grant-not-found");
    }
  });

  it("fails to export a pending (non-approved) grant", () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: "grant-pending",
      tenantId: "tenant-1",
      agentId: "agent-1",
      capability: baseCapability,
      requestedBy: "human-1",
      requestedAt: now,
      status: "pending" as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;

    const result = exportGrantAsVC(state, "grant-pending", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("vc.grant-not-approved");
    }
  });

  it("fails to export a grant for a missing agent", () => {
    let state = createRegistry();
    state = registerAgent(state, baseAgent).state;
    const grant = {
      id: "grant-orphan",
      tenantId: "tenant-1",
      agentId: "agent-1",
      capability: baseCapability,
      requestedBy: "human-1",
      requestedAt: now,
      status: "pending" as const,
      approvedBy: null,
      approvedAt: null,
    };
    state = requestGrant(state, grant).state;
    state = approveGrant(state, "grant-orphan", "admin-1", now).state;

    // Now remove the agent
    const newAgents = new Map(state.agents);
    newAgents.delete("agent-1");
    state = { ...state, agents: newAgents };

    const result = exportGrantAsVC(state, "grant-orphan", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("vc.agent-not-found");
    }
  });

  it("canonicalization is deterministic", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const c1 = canonicalizeCredential(result.value.credential);
    const c2 = canonicalizeCredential(result.value.credential);
    expect(c1).toBe(c2);

    const h1 = hashCanonical(c1);
    const h2 = hashCanonical(c2);
    expect(h1).toBe(h2);
  });

  it("attaches a proof to an unsigned credential", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const signed = attachProof(result.value.credential, "aabbccdd", {
      verificationMethod: "urn:cognate:issuer:org/example#key-1",
      created: now,
      cryptosuite: "eddsa-rdfc-2022",
    });

    expect(signed.proof).toBeDefined();
    expect(signed.proof?.type).toBe("DataIntegrityProof");
    expect(signed.proof?.cryptosuite).toBe("eddsa-rdfc-2022");
    expect(signed.proof?.proofPurpose).toBe("assertionMethod");
    expect(signed.proof?.proofValue).toBe("aabbccdd");
    expect(signed.proof?.verificationMethod).toBe("urn:cognate:issuer:org/example#key-1");
    expect(signed.proof?.created).toBe(now);
  });

  it("verifyProofStructure returns true for a valid signed credential", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const signed = attachProof(result.value.credential, "aabbccdd", {
      verificationMethod: "urn:cognate:issuer:org/example#key-1",
      created: now,
    });

    expect(verifyProofStructure(signed)).toBe(true);
  });

  it("verifyProofStructure returns false when proof is missing", () => {
    const state = setupApprovedGrant();
    const result = exportGrantAsVC(state, "grant-1", {
      issuerId: "org/example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(verifyProofStructure(result.value.credential as any)).toBe(false);
    expect(
      verifyProofStructure({
        ...result.value.credential,
        proof: {
          type: "OtherProof" as any,
          cryptosuite: "eddsa-rdfc-2022",
          proofPurpose: "assertionMethod",
          verificationMethod: "urn:key:1",
          proofValue: "aa",
          created: now,
        },
      }),
    ).toBe(false);
  });

  it("fails to export an incomplete approved grant missing approvedBy or approvedAt", () => {
    const state = setupApprovedGrant();
    const badGrants = new Map(state.grants);
    const existing = badGrants.get("grant-1")!;
    badGrants.set("grant-1", { ...existing, approvedBy: null });
    const res1 = exportGrantAsVC({ ...state, grants: badGrants }, "grant-1", {
      issuerId: "org/example",
    });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.error.code).toBe("vc.grant-incomplete");

    badGrants.set("grant-1", { ...existing, approvedAt: null });
    const res2 = exportGrantAsVC({ ...state, grants: badGrants }, "grant-1", {
      issuerId: "org/example",
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.error.code).toBe("vc.grant-incomplete");
  });
});
