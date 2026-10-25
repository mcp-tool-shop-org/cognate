import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "dist", "tests", "**/index.ts", "**/types.ts"],
      // Ratchet floor at the measured coverage, rounded down (measured 96.55 / 80 / 100 / 100;
      // target 90 for every metric). Never set it above what the suite measures.
      thresholds: {
        statements: 96,
        branches: 80,
        functions: 100,
        lines: 100,
      },
    },
  },
});
