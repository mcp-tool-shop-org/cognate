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
        statements: 99,
        branches: 93,
        functions: 95,
        lines: 99,
      },
    },
  },
});
