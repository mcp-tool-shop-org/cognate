#!/usr/bin/env node
// Makes the bundle's declarations self-contained, after tsup has built dist/.
//
// tsup inlines the @cognate/* workspace packages (and attestia, which the bundle doesn't depend on) into the JS, but
// its .d.ts files still import them by name, and none of them is installable from npm with the bundle. So a
// TypeScript consumer got unresolved types on every subpath. This copies each imported package's own compiled
// declarations into dist/_types/<package>/ and rewrites the import specifiers to relative paths. The declarations
// are the ones each package's tsc already emits and checks, unchanged apart from those paths.
//
// (tsup's dts.resolve was tried first. Rolling up from the packages' dist leaves their relative re-exports pointing
// at files the bundle doesn't have; rolling up from source makes rollup-plugin-dts emit `declare const x: typeof T`
// for types re-exported through the root entry's namespaces, which TypeScript rejects. It also can't follow
// attestia's subpath exports.)
//
// Runs as part of `pnpm build` in packages/cognate.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(pkgDir, "dist");
const vendor = join(dist, "_types");
const packagesDir = resolve(pkgDir, "..");

// A non-relative specifier in an import, export or import() expression. Lines of comments are skipped, so examples
// in doc comments ("import { evaluatePolicy } from '@cognate/policy'") stay as they are.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(["'])([^"'.][^"']*)\2/g;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/** The installed directory of an npm package, found by walking up node_modules from the bundle. */
function installedPackage(name) {
  for (let dir = pkgDir; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", ...name.split("/"));
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) throw new Error(`vendor-types: can't find ${name} in any node_modules above ${pkgDir}`);
  }
}

/**
 * Where a specifier's declarations are vendored, copying them on first use. Returns the vendored .d.ts file, or null
 * for a module the bundle's consumers get by installing it (a runtime dependency, or anything else not inlined).
 */
const copied = new Set();
const pending = [];
function vendored(spec) {
  const cognate = spec.match(/^@cognate\/([^/]+)$/);
  if (cognate) {
    const src = join(packagesDir, cognate[1], "dist");
    const name = JSON.parse(readFileSync(join(packagesDir, cognate[1], "package.json"), "utf8")).name;
    if (name !== spec) throw new Error(`vendor-types: packages/${cognate[1]} is ${name}, not ${spec}`);
    const dest = join(vendor, "cognate", cognate[1]);
    copyTree(src, dest);
    return join(dest, "index.d.ts");
  }
  const attestia = spec.match(/^@mcptoolshop\/attestia(?:\/([^/]+))?$/);
  if (attestia) {
    const src = join(installedPackage("@mcptoolshop/attestia"), "dist", `${attestia[1] ?? "index"}.d.ts`);
    const dest = join(vendor, "attestia", `${attestia[1] ?? "index"}.d.ts`);
    copyWithRelatives(src, dest);
    return dest;
  }
  return null;
}

function copyFile(src, dest) {
  if (copied.has(dest)) return false;
  copied.add(dest);
  mkdirSync(dirname(dest), { recursive: true });
  // Source maps point at sources the package doesn't ship.
  writeFileSync(dest, readFileSync(src, "utf8").replace(/\n?\/\/# sourceMappingURL=.*$/m, ""));
  pending.push(dest);
  return true;
}

function copyTree(src, dest) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(join(src, entry.name), join(dest, entry.name));
    else if (entry.name.endsWith(".d.ts")) copyFile(join(src, entry.name), join(dest, entry.name));
  }
}

// A single file from a package that isn't vendored whole: copy it and every declaration it reaches by a relative path.
function copyWithRelatives(src, dest) {
  if (!copyFile(src, dest)) return;
  for (const [, spec] of readFileSync(src, "utf8").matchAll(/from\s*["'](\.[^"']+)["']/g)) {
    const rel = spec.replace(/\.js$/, ".d.ts");
    copyWithRelatives(join(dirname(src), rel), join(dirname(dest), rel));
  }
}

function rewrite(file) {
  const text = readFileSync(file, "utf8");
  const out = text
    .split("\n")
    .map((line) =>
      COMMENT_LINE.test(line)
        ? line
        : line.replace(SPECIFIER, (whole, lead, quote, spec) => {
            const target = vendored(spec);
            if (target === null) return whole;
            let rel = relative(dirname(file), target).split(sep).join("/").replace(/\.d\.ts$/, ".js");
            if (!rel.startsWith(".")) rel = `./${rel}`;
            return `${lead}${quote}${rel}${quote}`;
          }),
    )
    .join("\n");
  if (out !== text) writeFileSync(file, out);
}

for (const f of readdirSync(dist)) if (f.endsWith(".d.ts")) pending.push(join(dist, f));
while (pending.length > 0) rewrite(pending.shift());
console.log(`vendor-types: ${copied.size} declaration files vendored into dist/_types`);
