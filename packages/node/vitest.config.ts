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
      // The org's 90% bar, adopted here because this package measures above it.
      thresholds: {
        statements: 92,
        branches: 84,
        functions: 96,
        lines: 92,
      },
    },
  },
});
