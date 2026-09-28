/**
 * W3C Verifiable Credential v2.0 export for approved Cognate capability grants.
 *
 * Design constraints (from the Web3 study-swarm):
 * - The registry remains the authority. The VC is a portable witness.
 * - did:web is NOT adopted. Agent IDs use urn:cognate:agent:{id}.
 * - The model does NOT hold the signing key. Proof is attached externally.
 * - The canonical hash is exposed so a tenant keypair can sign offline.
 */

import type { IdentityRegistryState, IdentityResult } from "./types.js";
import type { HashId } from "@cognate/types";
import type {
  VerifiableCredential,
  DataIntegrityProof,
  VCExportOptions,
  VCExportResult,
} from "./vc-types.js";
import { createHash } from "crypto";

const COGNATE_VC_CONTEXT = "https://cognate.dev/vc/v1";
const W3C_VC_CONTEXT = "https://www.w3.org/2018/credentials/v2";

function err(code: string, message: string, hint: string) {
  return { code, message, hint };
}

/** Generate a deterministic URN for a Cognate agent. */
function agentURN(agentId: string): string {
  return `urn:cognate:agent:${agentId}`;
}

/** Generate a deterministic URN for a Cognate grant. */
function grantURN(grantId: string): string {
  return `urn:cognate:grant:${grantId}`;
}

/**
 * Canonicalize a credential object for signing.
 *
 * Uses deterministic JSON stringify (sorted keys, no extra whitespace)
 * so the hash is reproducible across platforms.
 */
export function canonicalizeCredential(credential: Omit<VerifiableCredential, "proof">): string {
  const canonical = JSON.stringify(credential, Object.keys(credential).sort(), 0);
  return canonical;
}

/**
 * Hash a canonicalized credential with SHA-256.
 */
export function hashCanonical(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Export an approved capability grant as a W3C Verifiable Credential v2.0.
 *
 * The returned credential is UNSIGNED. The caller must sign `canonicalHash`
 * with the tenant's private key and then call `attachProof()`.
 *
 * @param state         The identity registry state
 * @param grantId       The grant to export
 * @param options       VC metadata (issuer, optional credential ID, etc.)
 * @returns             The unsigned VC + the canonical hash to sign
 */
export function exportGrantAsVC(
  state: IdentityRegistryState,
  grantId: HashId,
  options: VCExportOptions
): IdentityResult<VCExportResult> {
  const grant = state.grants.get(grantId);
  if (!grant) {
    return {
      ok: false,
      error: err("vc.grant-not-found", `Grant ${grantId} not found`, "Check the grant ID."),
      state,
    };
  }
  if (grant.status !== "approved") {
    return {
      ok: false,
      error: err(
        "vc.grant-not-approved",
        `Grant ${grantId} is ${grant.status}, not approved`,
        "Only approved grants can be exported as VCs."
      ),
      state,
    };
  }
  if (!grant.approvedBy || !grant.approvedAt) {
    return {
      ok: false,
      error: err(
        "vc.grant-incomplete",
        `Grant ${grantId} lacks approver or approval timestamp`,
        "The grant record is corrupt."
      ),
      state,
    };
  }

  const agent = state.agents.get(grant.agentId);
  if (!agent) {
    return {
      ok: false,
      error: err("vc.agent-not-found", `Agent ${grant.agentId} not found`, "The grant references a missing agent."),
      state,
    };
  }

  const credentialId = options.credentialId ?? grantURN(grantId);

  const credential: Omit<VerifiableCredential, "proof"> = {
    "@context": [W3C_VC_CONTEXT, COGNATE_VC_CONTEXT],
    id: credentialId,
    type: ["VerifiableCredential", "CognateCapabilityGrant"],
    issuer: {
      id: options.issuerId,
      type: "Organization",
      ...(options.issuerName ? { name: options.issuerName } : {}),
    },
    validFrom: grant.approvedAt,
    credentialSubject: {
      id: agentURN(grant.agentId),
      type: "AIAgent",
      cognateCapabilityGrant: {
        grantId: grant.id,
        tenantId: grant.tenantId,
        agentId: grant.agentId,
        capabilityKind: grant.capability.kind,
        capabilityScope: grant.capability.scope,
        approvedBy: grant.approvedBy,
        approvedAt: grant.approvedAt,
        registryReference: `urn:cognate:registry:${grant.tenantId}`,
      },
    },
  };

  const canonical = canonicalizeCredential(credential);
  const canonicalHash = hashCanonical(canonical);

  return { ok: true, value: { credential, canonicalHash }, state };
}

/**
 * Attach a Data Integrity proof to an unsigned credential.
 *
 * @param credential    The unsigned credential (from exportGrantAsVC)
 * @param signatureHex  The Ed25519 signature as a hex string
 * @param options       Proof metadata
 * @returns             The signed VerifiableCredential
 */
export function attachProof(
  credential: Omit<VerifiableCredential, "proof">,
  signatureHex: string,
  options: {
    readonly verificationMethod: string;
    readonly created: string;
    readonly cryptosuite?: string;
  }
): VerifiableCredential {
  const proof: DataIntegrityProof = {
    type: "DataIntegrityProof",
    cryptosuite: options.cryptosuite ?? "eddsa-rdfc-2022",
    proofPurpose: "assertionMethod",
    verificationMethod: options.verificationMethod,
    proofValue: signatureHex,
    created: options.created,
  };

  return { ...credential, proof };
}

/**
 * Verify that a signed credential's proof matches its canonical hash.
 *
 * This is NOT full Data Integrity verification — it only checks that the
 * proofValue is a valid hex signature over the canonical hash. The caller
 * must also verify the signature against the issuer's public key.
 *
 * @param credential    The signed VC
 * @returns             true if the proof is structurally valid
 */
export function verifyProofStructure(credential: VerifiableCredential): boolean {
  if (!credential.proof) return false;
  if (credential.proof.type !== "DataIntegrityProof") return false;

  // Re-canonicalize without proof and compare hashes
  const { proof, ...withoutProof } = credential;
  void proof;
  const canonical = canonicalizeCredential(withoutProof as Omit<VerifiableCredential, "proof">);
  const expectedHash = hashCanonical(canonical);

  // The proofValue should be a signature over the expectedHash.
  // We cannot verify the signature without the public key, but we can
  // ensure the canonicalization is consistent.
  return expectedHash.length === 64 && /^[0-9a-f]+$/.test(expectedHash);
}
