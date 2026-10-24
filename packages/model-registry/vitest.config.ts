import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 98,
        branches: 97,
        functions: 100,
        lines: 98,
      },
      exclude: [
        "node_modules",
        "dist",
        "tests",
        "**/*.test.ts",
        "**/index.ts",
        "**/types.ts",
      ],
    },
  },
});
