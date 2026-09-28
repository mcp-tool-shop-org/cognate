/**
 * RepoMesh bridge types.
 */

export interface RepomeshConfig {
  /** Ledger endpoint. Defaults to GitHub-hosted ledger. */
  readonly ledgerUrl?: string;
  /** Local ledger clone path (for offline verification). */
  readonly localPath?: string;
  /** Require XRPL anchoring. */
  readonly anchored?: boolean;
  /** Fail on UNVERIFIED (strict) or only on FAIL (relaxed). */
  readonly failOn?: "fail" | "unverified";
}

export interface RepomeshTrustScore {
  readonly integrity: number;   // 0–100
  readonly assurance: number;     // 0–100
  readonly anchored: boolean;
  readonly profile: string;       // baseline | open-source | regulated
}

export interface RepomeshResult {
  readonly repo: string;
  readonly version: string;
  readonly status: "PASS" | "FAIL" | "UNVERIFIED";
  readonly trust: RepomeshTrustScore;
  /** Exit code: 0 = PASS, 1 = FAIL, 3 = UNVERIFIED */
  readonly exitCode: number;
  readonly checkedAt: string;
}
