import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { failStartup, formatStartupFailure, isDebug } from "../src/startup-errors.js";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const entrypoint = resolve(testDir, "../dist/index.js");

interface Run {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runEntrypoint(env: Record<string, string>, args: readonly string[] = []): Promise<Run> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: resolve(testDir, "../../.."),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "0",
        ...env,
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        // already gone
      }
      done({ exitCode, stdout, stderr });
    };
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("exit", (code) => finish(code));
    setTimeout(() => finish(null), 8000);
  });
}

function parseFailure(run: Run): { ok: false; error: { code: string; message: string; hint: string } } {
  const line = run.stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("{"));
  expect(line, `no JSON error line on stderr: ${run.stderr}`).toBeDefined();
  return JSON.parse(line!) as never;
}

describe("startup configuration errors", () => {
  let tmp = "";
  let dataDir = "";
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "cognate-startup-"));
    dataDir = join(tmp, "data");
  });
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function expectStructuredExit(run: Run, code: string): { message: string; hint: string } {
    expect(run.stdout).not.toContain("Cognate API listening");
    expect(run.exitCode).toBe(1);
    const failure = parseFailure(run);
    expect(failure.ok).toBe(false);
    expect(failure.error.code).toBe(code);
    expect(failure.error.message.length).toBeGreaterThan(0);
    expect(failure.error.hint.length).toBeGreaterThan(0);
    // No raw stack trace: no "at file:line" frames and no uncaught-error banner.
    expect(run.stderr).not.toMatch(/^\s+at\s/m);
    expect(run.stderr).not.toContain("Node.js v");
    return failure.error;
  }

  it("a missing roots file prints code, message and hint and exits 1 without a stack", async () => {
    const missing = join(tmp, "no-such-roots.json");
    const run = await runEntrypoint({ COGNATE_DATA_DIR: dataDir, COGNATE_TENANT_ROOTS_PATH: missing });
    const error = expectStructuredExit(run, "auth.missing-tenant-roots");
    expect(error.message).toContain("not found");
    expect(error.hint).toContain("COGNATE_TENANT_ROOTS_PATH");
  });

  it("no roots path at all (the Docker quick start) names the variable to set", async () => {
    const run = await runEntrypoint({ COGNATE_DATA_DIR: dataDir });
    const error = expectStructuredExit(run, "auth.missing-tenant-roots");
    expect(error.hint).toContain("COGNATE_TENANT_ROOTS_PATH");
  });

  it("a malformed roots file prints the parse error code and exits 1 without a stack", async () => {
    const malformed = join(tmp, "malformed-roots.json");
    writeFileSync(malformed, "{ this is not json", "utf8");
    const run = await runEntrypoint({ COGNATE_DATA_DIR: dataDir, COGNATE_TENANT_ROOTS_PATH: malformed });
    const error = expectStructuredExit(run, "auth.invalid-tenant-roots");
    expect(error.hint).toContain('"version": 1');
  });

  it("an empty roots list exits 1 and says to configure at least one root", async () => {
    const empty = join(tmp, "empty-roots.json");
    writeFileSync(empty, JSON.stringify({ version: 1, roots: [] }), "utf8");
    const run = await runEntrypoint({ COGNATE_DATA_DIR: dataDir, COGNATE_TENANT_ROOTS_PATH: empty });
    const error = expectStructuredExit(run, "auth.missing-tenant-roots");
    expect(error.message).toContain("contains no root keys");
    expect(error.hint).toContain("at least one");
  });

  it("COGNATE_DEBUG=1 and --debug add the stack", async () => {
    const missing = join(tmp, "no-such-roots.json");
    for (const variant of [
      { env: { COGNATE_DEBUG: "1" }, args: [] as string[] },
      { env: {}, args: ["--debug"] },
    ]) {
      const run = await runEntrypoint(
        { COGNATE_DATA_DIR: dataDir, COGNATE_TENANT_ROOTS_PATH: missing, ...variant.env },
        variant.args,
      );
      expect(run.exitCode).toBe(1);
      expect(parseFailure(run).error.code).toBe("auth.missing-tenant-roots");
      expect(run.stderr).toMatch(/^\s+at\s/m);
    }
  });

  it("a bad signed-requests setting is also a structured config error", async () => {
    const run = await runEntrypoint({ COGNATE_DATA_DIR: dataDir, COGNATE_SIGNED_REQUESTS: "sometimes" });
    expect(run.exitCode).toBe(1);
    const failure = parseFailure(run);
    expect(failure.error.code).toBe("startup.invalid-configuration");
    expect(failure.error.hint.length).toBeGreaterThan(0);
    expect(run.stderr).not.toMatch(/^\s+at\s/m);
  });
});

describe("formatStartupFailure", () => {
  it("keeps the code and hint of a structured error", () => {
    const err = Object.assign(new Error("boom"), { code: "x.y", hint: "do z" });
    const out = formatStartupFailure(err, false);
    expect(JSON.parse(out)).toEqual({ ok: false, error: { code: "x.y", message: "boom", hint: "do z" } });
  });

  it("wraps an unstructured Error and a non-Error value with a generic code and hint", () => {
    const a = JSON.parse(formatStartupFailure(new Error("bad env"), false));
    expect(a.error.code).toBe("startup.invalid-configuration");
    expect(a.error.message).toBe("bad env");
    expect(a.error.hint).toContain("COGNATE_DEBUG");
    const b = JSON.parse(formatStartupFailure("oops", false));
    expect(b.error.message).toBe("oops");
  });

  it("appends the stack only in debug mode", () => {
    const err = new Error("boom");
    expect(formatStartupFailure(err, false)).not.toContain("\n");
    expect(formatStartupFailure(err, true)).toContain("\n");
    expect(formatStartupFailure(err, true)).toContain(" at ");
  });
});

describe("isDebug and failStartup", () => {
  it("isDebug reads COGNATE_DEBUG=1 or --debug and nothing else", () => {
    expect(isDebug({}, [])).toBe(false);
    expect(isDebug({ COGNATE_DEBUG: "0" }, [])).toBe(false);
    expect(isDebug({ COGNATE_DEBUG: " 1 " }, [])).toBe(true);
    expect(isDebug({}, ["--debug"])).toBe(true);
  });

  it("failStartup writes one JSON line to stderr and exits 1", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    try {
      const err = Object.assign(new Error("no roots"), { code: "auth.missing-tenant-roots", hint: "set it" });
      expect(() => failStartup(err)).toThrow("exit:1");
      const out = String(write.mock.calls[0]![0]);
      expect(out.endsWith(String.fromCharCode(10))).toBe(true);
      expect(JSON.parse(out).error).toEqual({ code: "auth.missing-tenant-roots", message: "no roots", hint: "set it" });
    } finally {
      write.mockRestore();
      exit.mockRestore();
    }
  });
});
