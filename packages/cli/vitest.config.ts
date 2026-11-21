import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ["./__tests__/e2e/setup.ts"],
    include: ["src/**/*.test.ts", "__tests__/**/*.test.ts"],
  },
});
