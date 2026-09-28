/**
 * @cognate/repomesh-bridge — RepoMesh integration for Cognate
 *
 * Provides typed wrappers around RepoMesh verification primitives.
 * Cognate agents with a `verify-repomesh` capability can use this
 * to verify releases, check trust scores, and anchor attestations.
 *
 * Repomesh defers to Cognate. This bridge is a data source, not
 * an authority. Cognate policy engine decides what verification
 * results mean for AI governance.
 */

export type { RepomeshResult, RepomeshTrustScore, RepomeshConfig } from "./types.js";
export {
  verifyRelease,
  verifyAll,
  checkTrust,
  anchorPartition,
} from "./verify.js";
