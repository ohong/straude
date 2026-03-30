import { defineConfig } from "@playwright/test";

const port = process.env.CI ? 3000 : 3099;
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
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
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
