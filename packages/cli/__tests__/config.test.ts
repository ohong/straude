import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_API_URL,
  CLI_VERSION,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  MAX_BACKFILL_DAYS,
} from "../src/config.js";

describe("config", () => {
  it("CONFIG_DIR points to ~/.straude", () => {
    expect(CONFIG_DIR).toBe(join(homedir(), ".straude"));
  });

  it("CONFIG_FILE points to ~/.straude/config.json", () => {
    expect(CONFIG_FILE).toBe(join(homedir(), ".straude", "config.json"));
  });

  it("DEFAULT_API_URL is straude.com", () => {
    expect(DEFAULT_API_URL).toBe("https://straude.com");
  });

  it("CLI_VERSION is a semver string", () => {
    expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("POLL_INTERVAL_MS is 2 seconds", () => {
    expect(POLL_INTERVAL_MS).toBe(2000);
  });

  it("POLL_TIMEOUT_MS is 5 minutes", () => {
    expect(POLL_TIMEOUT_MS).toBe(300_000);
  });

  it("MAX_BACKFILL_DAYS is 7", () => {
    expect(MAX_BACKFILL_DAYS).toBe(7);
  });
});
