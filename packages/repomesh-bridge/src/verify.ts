/**
 * RepoMesh verification bridge — real implementation over @mcptoolshop/repomesh.
 */

import {
  computeVerifyResult,
  verifyAll as repomeshVerifyAll,
  exitCodeForStatus,
  verifyAnchorTx,
} from "@mcptoolshop/repomesh";
import type { RepomeshConfig, RepomeshResult, RepomeshTrustScore } from "./types.js";

function mapTrust(status: string, result: any): RepomeshTrustScore {
  const gate = result?.gate;
  const failures = gate?.failures?.length ?? 0;
  const anchored = result?.anchor?.anchored === true;
  const integrity = status === "PASS" ? 100 : status === "FAIL" ? 0 : anchored ? 50 : 25;
  const assurance = status === "PASS" ? 100 : failures > 0 ? Math.max(0, 100 - failures * 20) : anchored ? 50 : 25;
  const profile = gate?.profile ?? "baseline";
  return { integrity, assurance, anchored, profile };
}

function mapResult(repo: string, version: string, raw: any): RepomeshResult {
  const rawStatus = raw.status ?? "UNVERIFIED";
  const status = rawStatus === "ERROR" ? "UNVERIFIED" : rawStatus;
  const exit = exitCodeForStatus(status);
  const result = raw.result ?? raw;
  return {
    repo,
    version,
    status,
    trust: mapTrust(status, result),
    exitCode: exit,
    checkedAt: new Date().toISOString(),
  };
}

export async function verifyRelease(
  repo: string,
  version: string,
  config: RepomeshConfig = {}
): Promise<RepomeshResult> {
  const raw = await computeVerifyResult({
    repo,
    version,
    anchored: config.anchored ?? false,
    anchoredOrLocal: false,
    ledgerUrl: config.ledgerUrl,
    local: config.localPath !== undefined,
    localDir: config.localPath,
    human: false,
  });
  return mapResult(repo, version, raw);
}

export async function verifyAll(config: RepomeshConfig = {}): Promise<RepomeshResult[]> {
  const raw = await repomeshVerifyAll({
    anchored: config.anchored ?? false,
    ledgerUrl: config.ledgerUrl,
    local: config.localPath !== undefined,
    localDir: config.localPath,
    human: false,
  });
  if (!Array.isArray(raw?.results)) return [];
  return raw.results.map((r: any) => mapResult(r.result?.repo ?? "", r.result?.version ?? "", r));
}

export async function checkTrust(
  repo: string,
  version?: string,
  config?: RepomeshConfig
): Promise<RepomeshTrustScore> {
  if (version) {
    const raw = await computeVerifyResult({
      repo,
      version,
      anchored: config?.anchored ?? false,
      local: config?.localPath !== undefined,
      localDir: config?.localPath,
      human: false,
    });
    return mapTrust(raw.status ?? "UNVERIFIED", raw.result);
  }
  return { integrity: 0, assurance: 0, anchored: false, profile: "baseline" };
}

export async function anchorPartition(
  partitionId: string,
  merkleRoot: string,
  manifestHash: string,
  eventCount: number
): Promise<{ txHash: string; status: "pending" | "confirmed" }> {
  void partitionId;
  void merkleRoot;
  void manifestHash;
  void eventCount;
  void verifyAnchorTx;
  // Cognate does not hold XRPL signing keys. The anchor is broadcast by the
  // repomesh-xrpl-anchor node. This bridge returns pending until the anchor
  // cycle publishes the on-chain transaction and it appears in the ledger.
  return { txHash: "", status: "pending" };
}
