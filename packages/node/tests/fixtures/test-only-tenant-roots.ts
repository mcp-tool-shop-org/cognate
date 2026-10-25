import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TenantRootKeyEntry, TenantRootsConfig } from "@cognate/types";

const fixtureDir = fileURLToPath(new URL(".", import.meta.url));

/**
 * Path to the test-only tenant root key fixture file.
 * Rejected at server startup unless `allowTestOnlyRoots: true` is explicitly set.
 */
export const TEST_ONLY_TENANT_ROOTS_PATH = resolve(fixtureDir, "test-only-tenant-roots.json");

const parsed = JSON.parse(readFileSync(TEST_ONLY_TENANT_ROOTS_PATH, "utf8")) as TenantRootsConfig;

/**
 * Test-only tenant root public keys for unit and integration tests.
 * Rejected at server startup unless `allowTestOnlyRoots: true` is explicitly set.
 */
export const TEST_ONLY_TENANT_ROOTS: readonly TenantRootKeyEntry[] = parsed.roots;
