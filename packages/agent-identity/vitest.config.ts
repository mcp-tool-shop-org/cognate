import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules",
        "dist",
        "tests",
        "**/*.test.ts",
        "**/index.ts",
        "**/types.ts",
      ],
      thresholds: {
        statements: 97,
        branches: 89,
        functions: 100,
        lines: 97,
      },
    },
  },
});
