import { defineConfig } from "@playwright/test";

// Performance harness: measures TTFB/FCP/LCP for every authenticated page
// against a production build talking to the real Supabase project.
// `bun run perf` = measure + scorecard; `bun run perf:check` = gate on targets.
const port = 3197;
export default defineConfig({
  testDir: "./e2e/perf",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./perf-results/playwright",
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
  },
  webServer: {
    command: `bun run start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { PERF_TIMING: "1" },
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "perf",
      dependencies: ["setup"],
      testMatch: /pages\.perf\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: "e2e/perf/.auth/storage-state.json",
      },
    },
  ],
});
