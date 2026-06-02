import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureCcusageInstalled,
  isCcusageInstalled,
  validateCcusageVersion,
  _resetCcusageResolver,
} from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execFileSync } from "node:child_process";

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
  _resetCcusageResolver();
});

describe("ensureCcusageInstalled", () => {
  it("validates the bundled ccusage binary and caches the resolved command", async () => {
    mockExecFileSync.mockReturnValue("ccusage 20.0.6" as never);

    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();
    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining("ccusage/dist/cli.js"), "--version"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it("reports true when the bundled binary is resolvable and new enough", () => {
    mockExecFileSync.mockReturnValue("ccusage 20.0.6" as never);

    expect(isCcusageInstalled()).toBe(true);
  });

  it("reports false when version validation fails", () => {
    mockExecFileSync.mockReturnValue("ccusage 20.0.4" as never);

    expect(isCcusageInstalled()).toBe(false);
  });

  it("throws when the bundled binary reports an old version", async () => {
    mockExecFileSync.mockReturnValue("ccusage 20.0.4" as never);

    await expect(ensureCcusageInstalled()).rejects.toThrow(
      "ccusage 20.0.5 or newer is required; found 20.0.4.",
    );
  });

  it("throws when version output cannot be parsed", async () => {
    mockExecFileSync.mockReturnValue("not a version" as never);

    await expect(ensureCcusageInstalled()).rejects.toThrow(
      "Failed to parse bundled ccusage version",
    );
  });

  it("wraps validation exec errors with stderr detail", async () => {
    const err = new Error("failed") as Error & { stderr: string };
    err.stderr = "permission denied";
    mockExecFileSync.mockImplementation(() => {
      throw err;
    });

    await expect(ensureCcusageInstalled()).rejects.toThrow(
      "Failed to validate bundled ccusage version: permission denied",
    );
  });
});

describe("validateCcusageVersion", () => {
  it("accepts the minimum supported version", () => {
    expect(() => validateCcusageVersion("20.0.5")).not.toThrow();
  });

  it("accepts newer versions", () => {
    expect(() => validateCcusageVersion("20.1.0")).not.toThrow();
  });

  it("rejects older versions", () => {
    expect(() => validateCcusageVersion("20.0.4")).toThrow(
      "ccusage 20.0.5 or newer is required; found 20.0.4.",
    );
  });
});
