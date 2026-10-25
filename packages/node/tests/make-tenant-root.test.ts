import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const script = join(repoRoot, "scripts", "make-tenant-root.mjs");

function run(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function errorLine(stderr: string): { code: string; message: string; hint: string } {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("{"));
  expect(line, `no JSON error line on stderr: ${stderr}`).toBeDefined();
  return JSON.parse(line!) as { code: string; message: string; hint: string };
}

describe("scripts/make-tenant-root.mjs never overwrites a key without --force", () => {
  let dir = "";
  let roots = "";
  let secret = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cognate-root-"));
    roots = join(dir, "tenant-roots.json");
    secret = join(dir, "tenant-root.secret.json");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a first run writes both files", () => {
    const r = run(["t1", dir]);
    expect(r.status).toBe(0);
    expect(existsSync(roots)).toBe(true);
    expect(existsSync(secret)).toBe(true);
    expect(JSON.parse(readFileSync(roots, "utf8")).roots[0].tenantId).toBe("t1");
  });

  it("a second run without --force refuses, exits non-zero, and leaves both files byte-identical", () => {
    expect(run(["t1", dir]).status).toBe(0);
    const rootsBefore = readFileSync(roots);
    const secretBefore = readFileSync(secret);

    const r = run(["t1", dir]);
    expect(r.status).not.toBe(0);
    const err = errorLine(r.stderr);
    expect(err.code).toBe("exists");
    expect(err.message).toContain("already exists");
    expect(err.hint).toContain("--force");
    expect(r.stderr).not.toMatch(/^\s+at\s/m);

    expect(readFileSync(roots).equals(rootsBefore)).toBe(true);
    expect(readFileSync(secret).equals(secretBefore)).toBe(true);
  });

  it("checks both files before writing either: an existing secret alone blocks the run and no roots file appears", () => {
    writeFileSync(secret, '{"seedHex":"keep-me"}\n');
    const before = readFileSync(secret);

    const r = run(["t1", dir]);
    expect(r.status).not.toBe(0);
    expect(errorLine(r.stderr).code).toBe("exists");
    expect(existsSync(roots)).toBe(false);
    expect(readFileSync(secret).equals(before)).toBe(true);
  });

  it("an existing roots file alone blocks the run and the secret is not created", () => {
    writeFileSync(roots, '{"version":1,"roots":[]}\n');
    const before = readFileSync(roots);

    const r = run(["t1", dir]);
    expect(r.status).not.toBe(0);
    expect(errorLine(r.stderr).code).toBe("exists");
    expect(existsSync(secret)).toBe(false);
    expect(readFileSync(roots).equals(before)).toBe(true);
  });

  it("--force replaces both files with a new key, and the secret is still mode 600 on POSIX", () => {
    expect(run(["t1", dir]).status).toBe(0);
    const secretBefore = readFileSync(secret, "utf8");
    const rootsBefore = readFileSync(roots, "utf8");

    const r = run(["t1", dir, "--force"]);
    expect(r.status).toBe(0);
    expect(readFileSync(secret, "utf8")).not.toBe(secretBefore);
    expect(readFileSync(roots, "utf8")).not.toBe(rootsBefore);
    if (process.platform !== "win32") {
      expect(statSync(secret).mode & 0o777).toBe(0o600);
    }
  });

  it("--force also resets a secret file that was made group-readable (POSIX)", () => {
    if (process.platform === "win32") return;
    expect(run(["t1", dir]).status).toBe(0);
    // chmod via the same mechanism an operator would: loosen it, then --force must tighten it again.
    spawnSync("chmod", ["644", secret]);
    expect(statSync(secret).mode & 0o777).toBe(0o644);
    expect(run(["t1", dir, "--force"]).status).toBe(0);
    expect(statSync(secret).mode & 0o777).toBe(0o600);
  });

  it("--force may come before the tenant id", () => {
    expect(run(["--force", "t2", dir]).status).toBe(0);
    expect(JSON.parse(readFileSync(roots, "utf8")).roots[0].tenantId).toBe("t2");
  });

  it("a missing tenant id keeps its usage error (exit 2)", () => {
    const r = run([]);
    expect(r.status).toBe(2);
    expect(errorLine(r.stderr).code).toBe("usage");
  });

  it("an unknown option is a usage error, not an output directory", () => {
    const r = run(["t1", dir, "--frce"]);
    expect(r.status).toBe(2);
    expect(errorLine(r.stderr).code).toBe("usage");
    expect(existsSync(roots)).toBe(false);
  });
});
