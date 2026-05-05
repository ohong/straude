import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Separate config for integration tests that exercise the real Supabase
 * stack (Postgres + PostgREST + Storage + GoTrue) booted via
 * `bunx supabase start`. The default `vitest.config.ts` runs the fast
 * mock-based suite; this one opts in via `bun run test:integration`.
 *
 * CI installs the Supabase CLI and runs `bunx supabase start` before
 * invoking this config. Locally, run `bun run local:up` first.
 */

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["__tests__/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    globalSetup: ["./__tests__/integration/global-setup.ts"],
    // First request through the route handler can be slow under cold
    // PostgREST + initial query plan — give individual tests room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run integration suites serially. They share one Supabase stack and
    // each suite's `beforeEach` truncates data tables — parallel execution
    // would let one suite TRUNCATE rows another is mid-test on. Adding more
    // suites later is fine; this keeps them isolated by serialization.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
