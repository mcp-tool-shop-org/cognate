import { defineConfig } from "tsup";

/**
 * Bundles the @cognate/* libraries into @mcptoolshop/cognate.
 * noExternal inlines the workspace packages so the tarball has no workspace:* deps.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
    policy: "src/policy.ts",
    "model-registry": "src/model-registry.ts",
    "agent-identity": "src/agent-identity.ts",
    "prompt-store": "src/prompt-store.ts",
    "repomesh-bridge": "src/repomesh-bridge.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  target: "node22",
  noExternal: [/^@cognate\//],
});
