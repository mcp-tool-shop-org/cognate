/**
 * W3C Verifiable Credential v2.0 export types.
 *
 * These types model the VC Data Model 2.0 Recommendation (15 May 2025).
 * They are serializable JSON objects — no crypto operations here.
 */

/** A W3C Verifiable Credential v2.0. */
export interface VerifiableCredential {
  readonly "@context": readonly string[];
  readonly id: string;
  readonly type: readonly string[];
  readonly issuer: Issuer;
  readonly validFrom: string; // ISO 8601 timestamp
  readonly validUntil?: string; // ISO 8601 timestamp
  readonly credentialSubject: CredentialSubject;
  readonly proof?: DataIntegrityProof;
}

export interface Issuer {
  readonly id: string;
  readonly type?: string;
  readonly name?: string;
}

export interface CredentialSubject {
  readonly id: string;
  readonly type?: string;
  // Cognate-specific extension
  readonly cognateCapabilityGrant?: CognateCapabilityGrantSubject;
}

/** The Cognate-specific payload inside credentialSubject. */
export interface CognateCapabilityGrantSubject {
  readonly grantId: string;
  readonly tenantId: string;
  readonly agentId: string;
  readonly capabilityKind: string;
  readonly capabilityScope: unknown;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly registryReference: string; // URN pointing to the Cognate registry
}

/** W3C Data Integrity proof (eddsa-rdfc-2022 suite). */
export interface DataIntegrityProof {
  readonly type: "DataIntegrityProof";
  readonly cryptosuite: string;
  readonly proofPurpose: "assertionMethod";
  readonly verificationMethod: string;
  readonly proofValue: string; // base64-url-encoded signature
  readonly created: string; // ISO 8601 timestamp
}

/** Options for creating a VC export. */
export interface VCExportOptions {
  readonly issuerId: string;
  readonly issuerName?: string;
  readonly credentialId?: string; // optional URN; one will be generated if omitted
  readonly verificationMethod?: string; // URN of the signing key
}

/** Result of exporting a grant as a VC. */
export interface VCExportResult {
  readonly credential: VerifiableCredential;
  readonly canonicalHash: string; // SHA-256 hex of canonicalized credential (without proof)
}
