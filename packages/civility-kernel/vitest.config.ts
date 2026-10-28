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
      // The org's 90% line bar, adopted here because this package measures 91.9% of lines.
      thresholds: {
        lines: 90,
      },
    },
  },
});
