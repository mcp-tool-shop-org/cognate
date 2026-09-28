import { describe, expect, it } from "vitest";
import { verifyRelease, verifyAll, checkTrust, anchorPartition } from "../src/verify.js";

describe("repomesh-bridge", () => {
  it("verifyRelease returns a result", async () => {
    const result = await verifyRelease("mcp-tool-shop-org/cognate", "0.1.1");
    expect(result.repo).toBe("mcp-tool-shop-org/cognate");
    expect(result.version).toBe("0.1.1");
    expect(["PASS", "FAIL", "UNVERIFIED"]).toContain(result.status);
    expect(result.exitCode).toBe(3); // UNVERIFIED placeholder
  });

  it("verifyRelease accepts config", async () => {
    const result = await verifyRelease("org/repo", "1.0.0", {
      anchored: true,
      failOn: "fail",
    });
    expect(result.repo).toBe("org/repo");
  });

  it("verifyAll returns empty array (placeholder)", async () => {
    const results = await verifyAll();
    expect(results).toEqual([]);
  });

  it("checkTrust returns a trust score", async () => {
    const score = await checkTrust("mcp-tool-shop-org/cognate");
    expect(score).toHaveProperty("integrity");
    expect(score).toHaveProperty("assurance");
    expect(score).toHaveProperty("anchored");
    expect(score).toHaveProperty("profile");
  });

  it("anchorPartition returns pending status", async () => {
    const result = await anchorPartition("p1", "root123", "manifest456", 100);
    expect(result.status).toBe("pending");
  });
});
