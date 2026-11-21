import { defineConfig, devices } from "@playwright/test";

const port = process.env.CI ? 3000 : 3099;
const snapshotSpec = "**/public-stats-freshness.spec.ts";
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/perf/**",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: useDevServer
      ? `bun run dev --port ${port}`
      : process.env.CI
      ? `bun run start -p ${port}`
      : `bun run build && bun run start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: useDevServer && !process.env.CI,
    timeout: useDevServer ? 60_000 : 240_000,
  },
  projects: [
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
      grep: /@mobile-journey/,
    },
    {
      name: "chromium",
      testIgnore: ["**/perf/**", snapshotSpec],
      use: { browserName: "chromium" },
    },
    {
      // This test changes the global snapshot and compares totals for every user.
      name: "snapshot",
      testMatch: snapshotSpec,
      dependencies: process.env.CI ? ["chromium", "mobile-webkit"] : [],
      use: { browserName: "chromium" },
    },
  ],
});
