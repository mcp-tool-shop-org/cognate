// Make a tenant root key for a local @cognate/node server.
//
// Usage, from the repository root after `pnpm install && pnpm -r build`:
//   node scripts/make-tenant-root.mjs <tenantId> [outDir]
//
// Writes two files into outDir (default: the current directory):
//   tenant-roots.json        the public key, for COGNATE_TENANT_ROOTS_PATH
//   tenant-root.secret.json  the private seed; keep it out of git and off shared disks
// Both names are in .gitignore. Keep the secret file out of the repository and out of any image; the server needs
// only tenant-roots.json. A new random key is made on every run; nothing is derived from a fixed seed.
import { chmodSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { generateEd25519KeyPair } from "../packages/node/dist/server.js";

const tenantId = process.argv[2];
const outDir = process.argv[3] ?? ".";
if (!tenantId) {
  console.error(JSON.stringify({
    code: "usage",
    message: "A tenant id is required.",
    hint: "node scripts/make-tenant-root.mjs <tenantId> [outDir]",
  }));
  process.exit(2);
}

const root = generateEd25519KeyPair();
const actorId = `root-${createHash("sha256").update(root.publicKey).digest("hex").slice(0, 16)}`;
writeFileSync(
  join(outDir, "tenant-roots.json"),
  JSON.stringify({ version: 1, roots: [{ tenantId, actorId, publicKey: root.publicKey, kid: root.kid }] }, null, 2) + "\n",
);
const secretPath = join(outDir, "tenant-root.secret.json");
writeFileSync(
  secretPath,
  JSON.stringify({ tenantId, actorId, kid: root.kid, seedHex: root.seedHex }, null, 2) + "\n",
  { mode: 0o600 },
);
// The mode above applies only when the file is created, so set it again for a file that already existed.
// Windows keeps only the read-only bit; there, keep the file in a folder only you can read.
chmodSync(secretPath, 0o600);
console.log(`Wrote tenant-roots.json and tenant-root.secret.json for tenant "${tenantId}" (root actor ${actorId}).`);
