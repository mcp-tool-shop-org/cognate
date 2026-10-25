// Make a tenant root key for a local @cognate/node server.
//
// Usage, from the repository root after `pnpm install && pnpm -r build`:
//   node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]
//
// Writes two files into outDir (default: the current directory):
//   tenant-roots.json        the public key, for COGNATE_TENANT_ROOTS_PATH
//   tenant-root.secret.json  the private seed; keep it out of git and off shared disks
// Both names are in .gitignore. Keep the secret file out of the repository and out of any image; the server needs
// only tenant-roots.json. A new random key is made on every run; nothing is derived from a fixed seed.
//
// If either file already exists the script refuses, writes nothing and exits 1: a second run would replace the
// tenant's private seed, and the old one cannot be recovered. Pass --force to replace both on purpose.
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { generateEd25519KeyPair } from "../packages/node/dist/server.js";

const USAGE = "node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]";
const args = process.argv.slice(2);
const unknown = args.filter((a) => a.startsWith("-") && a !== "--force");
const force = args.includes("--force");
const [tenantId, outDirArg] = args.filter((a) => !a.startsWith("-"));
const outDir = outDirArg ?? ".";
if (unknown.length > 0 || !tenantId) {
  console.error(JSON.stringify({
    code: "usage",
    message: unknown.length > 0 ? `Unknown option ${unknown[0]}.` : "A tenant id is required.",
    hint: USAGE,
  }));
  process.exit(2);
}

const rootsPath = join(outDir, "tenant-roots.json");
const secretPath = join(outDir, "tenant-root.secret.json");
// Check both files before writing either, so a refusal leaves both untouched.
const existing = [rootsPath, secretPath].filter((path) => existsSync(path));
if (existing.length > 0 && !force) {
  console.error(JSON.stringify({
    code: "exists",
    message: `${existing.join(" and ")} already exists; nothing was written.`,
    hint: "Running again would replace the tenant's private seed, and the old one cannot be recovered. Use another outDir, or pass --force to replace both on purpose.",
  }));
  process.exit(1);
}
// Without --force the flag "wx" also fails if a file appears between the check and the write.
const flag = force ? "w" : "wx";

const root = generateEd25519KeyPair();
const actorId = `root-${createHash("sha256").update(root.publicKey).digest("hex").slice(0, 16)}`;
writeFileSync(
  rootsPath,
  JSON.stringify({ version: 1, roots: [{ tenantId, actorId, publicKey: root.publicKey, kid: root.kid }] }, null, 2) + "\n",
  { flag },
);
writeFileSync(
  secretPath,
  JSON.stringify({ tenantId, actorId, kid: root.kid, seedHex: root.seedHex }, null, 2) + "\n",
  { mode: 0o600, flag },
);
// The mode above applies only when the file is created, so set it again for a file that --force replaced.
// Windows keeps only the read-only bit; there, keep the file in a folder only you can read.
chmodSync(secretPath, 0o600);
console.log(`Wrote tenant-roots.json and tenant-root.secret.json for tenant "${tenantId}" (root actor ${actorId}).`);
