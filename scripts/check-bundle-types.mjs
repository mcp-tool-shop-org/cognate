#!/usr/bin/env node
// Checks that @mcptoolshop/cognate's type declarations work for someone who installs it from npm.
//
// The @cognate/* workspace packages are inlined into the bundle's JS but are not on npm, so a .d.ts that still
// imports one leaves a TypeScript consumer with unresolved types. This script:
//   1. fails if an entry declaration (dist/*.d.ts) mentions "@cognate/", or any declaration under dist/ imports a
//      module that is neither relative nor a runtime dependency;
//   2. packs the bundle the way release.yml does (devDependencies deleted), installs the tarball into an empty
//      project with only typescript and @types/node, and runs strict `tsc --noEmit` under moduleResolution "bundler"
//      and "node16" on a file that imports a type and a value from the root entry and from every subpath.
//
// Run after `pnpm build`:  node scripts/check-bundle-types.mjs
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "packages", "cognate");
const dist = join(bundle, "dist");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
}

let failed = false;

// 1a. The entry declarations (dist/*.d.ts) don't mention @cognate/ at all.
const leaks = readdirSync(dist)
  .filter((f) => f.endsWith(".d.ts"))
  .filter((f) => readFileSync(join(dist, f), "utf8").includes("@cognate/"));
if (leaks.length > 0) {
  console.error(`FAIL: ${leaks.length} declaration file(s) in packages/cognate/dist mention @cognate/: ${leaks.join(", ")}`);
  failed = true;
} else {
  console.log("ok: no packages/cognate/dist/*.d.ts mentions @cognate/");
}

// 1b. Every module any declaration under dist/ imports must ship with the bundle (a relative path) or be one of its
//     runtime dependencies. That rules out @cognate/* and anything inlined into the JS, such as attestia. Comment
//     lines are skipped: a doc comment may name a workspace package in an example.
const deps = new Set(Object.keys(JSON.parse(readFileSync(join(bundle, "package.json"), "utf8")).dependencies ?? {}));
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|<reference\s+(?:path|types)=)["']([^"']+)["']/g;
const COMMENT_LINE = /^\s*(\/\/(?!\/\s*<reference)|\/\*|\*)/;
const declarations = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? declarations(join(dir, e.name)) : e.name.endsWith(".d.ts") ? [join(dir, e.name)] : [],
  );
const strays = [];
for (const file of declarations(dist)) {
  for (const line of readFileSync(file, "utf8").split("\n").filter((l) => !COMMENT_LINE.test(l))) {
    for (const [, spec] of line.matchAll(SPECIFIER)) {
      const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (!spec.startsWith(".") && !deps.has(pkg)) strays.push(`${file.slice(dist.length + 1)}: ${spec}`);
    }
  }
}
if (strays.length > 0) {
  console.error(`FAIL: declarations import modules that don't ship with the bundle:\n  ${strays.join("\n  ")}`);
  failed = true;
} else {
  console.log(`ok: every declaration under dist/ imports only relative files and dependencies (${[...deps].join(", ")})`);
}

// 2. Pack it as release.yml does, then compile against the installed tarball.
const work = mkdtempSync(join(tmpdir(), "cognate-types-"));
try {
  const stage = join(work, "stage");
  cpSync(bundle, stage, { recursive: true, filter: (src) => !src.includes("node_modules") });
  run(npm, ["pkg", "delete", "devDependencies"], stage);
  const tarball = run(npm, ["pack", "--silent", "--pack-destination", work], stage).trim().split(/\r?\n/).pop();

  const consumer = join(work, "consumer");
  cpSync(join(root, "scripts", "bundle-types-fixture"), consumer, { recursive: true });
  run(npm, ["install", "--silent", "--no-audit", "--no-fund", join(work, tarball), "typescript@5", "@types/node@22"], consumer);

  for (const config of ["tsconfig.bundler.json", "tsconfig.node16.json"]) {
    try {
      run(npx, ["tsc", "--noEmit", "-p", config], consumer);
      console.log(`ok: tsc --noEmit -p ${config}`);
    } catch (err) {
      console.error(`FAIL: tsc --noEmit -p ${config}\n${err.stdout ?? ""}${err.stderr ?? ""}`);
      failed = true;
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log("bundle types: OK");
