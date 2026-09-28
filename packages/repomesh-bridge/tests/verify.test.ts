import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyRelease, verifyAll, checkTrust, anchorPartition } from "../src/verify.js";

vi.mock("@mcptoolshop/repomesh", async () => {
  const actual = await vi.importActual("@mcptoolshop/repomesh") as any;
  return {
    ...actual,
    computeVerifyResult: vi.fn(),
    verifyAll: vi.fn(),
    verifyAnchorTx: vi.fn(),
  };
});

import { computeVerifyResult, verifyAll as repomeshVerifyAll } from "@mcptoolshop/repomesh";

describe("repomesh-bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifyRelease maps PASS to Cognate result", async () => {
    (computeVerifyResult as any).mockResolvedValue({
      status: "PASS",
      result: {
        ok: true,
        repo: "org/repo",
        version: "1.0.0",
        gate: { status: "PASS", profile: "baseline" },
        anchor: { anchored: true },
      },
    });
    const result = await verifyRelease("org/repo", "1.0.0");
    expect(result.repo).toBe("org/repo");
    expect(result.version).toBe("1.0.0");
    expect(result.status).toBe("PASS");
    expect(result.exitCode).toBe(0);
    expect(result.trust.integrity).toBe(100);
    expect(result.trust.assurance).toBe(100);
    expect(result.trust.anchored).toBe(true);
  });

  it("verifyRelease maps FAIL to Cognate result", async () => {
    (computeVerifyResult as any).mockResolvedValue({
      status: "FAIL",
      result: {
        ok: false,
        repo: "org/repo",
        version: "1.0.0",
        gate: { status: "FAIL", failures: [{ check: "signature.chain", reason: "invalid" }], profile: "baseline" },
      },
    });
    const result = await verifyRelease("org/repo", "1.0.0");
    expect(result.status).toBe("FAIL");
    expect(result.exitCode).toBe(1);
    expect(result.trust.integrity).toBe(0);
  });

  it("verifyRelease maps ERROR to UNVERIFIED", async () => {
    (computeVerifyResult as any).mockResolvedValue({
      status: "ERROR",
      result: { ok: false, repo: "org/repo", version: "1.0.0", error: "network" },
    });
    const result = await verifyRelease("org/repo", "1.0.0");
    expect(result.status).toBe("UNVERIFIED");
    expect(result.exitCode).toBe(3);
  });

  it("verifyRelease forwards config", async () => {
    (computeVerifyResult as any).mockResolvedValue({
      status: "UNVERIFIED",
      result: { ok: false, repo: "org/repo", version: "1.0.0" },
    });
    await verifyRelease("org/repo", "1.0.0", { anchored: true, failOn: "fail", localPath: "/tmp/ledger" });
    expect(computeVerifyResult).toHaveBeenCalledWith(expect.objectContaining({
      anchored: true,
      local: true,
      localDir: "/tmp/ledger",
      human: false,
    }));
  });

  it("verifyAll returns mapped results", async () => {
    (repomeshVerifyAll as any).mockResolvedValue({
      results: [
        {
          status: "PASS",
          result: { ok: true, repo: "a/b", version: "1.0.0", gate: { status: "PASS", profile: "baseline" }, anchor: { anchored: true } },
        },
        {
          status: "UNVERIFIED",
          result: { ok: false, repo: "c/d", version: "2.0.0", gate: { status: "UNVERIFIED", profile: "baseline" } },
        },
      ],
    });
    const results = await verifyAll();
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("PASS");
    expect(results[1].status).toBe("UNVERIFIED");
  });

  it("verifyAll returns empty array when repomesh returns no results", async () => {
    (repomeshVerifyAll as any).mockResolvedValue({ results: [] });
    const results = await verifyAll();
    expect(results).toEqual([]);
  });

  it("checkTrust returns a trust score for a specific version", async () => {
    (computeVerifyResult as any).mockResolvedValue({
      status: "PASS",
      result: { ok: true, gate: { status: "PASS", profile: "open-source" }, anchor: { anchored: true } },
    });
    const score = await checkTrust("mcp-tool-shop-org/cognate", "0.1.1");
    expect(score).toHaveProperty("integrity");
    expect(score).toHaveProperty("assurance");
    expect(score).toHaveProperty("anchored");
    expect(score).toHaveProperty("profile");
    expect(score.integrity).toBe(100);
  });

  it("checkTrust returns baseline when version is missing", async () => {
    const score = await checkTrust("mcp-tool-shop-org/cognate");
    expect(score.integrity).toBe(0);
    expect(score.assurance).toBe(0);
    expect(score.anchored).toBe(false);
    expect(score.profile).toBe("baseline");
  });

  it("anchorPartition returns pending status", async () => {
    const result = await anchorPartition("p1", "root123", "manifest456", 100);
    expect(result.status).toBe("pending");
    expect(result.txHash).toBe("");
  });
});
