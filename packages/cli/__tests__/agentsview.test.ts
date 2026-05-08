import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  _resetAgentsViewResolver,
  hasAgentsView,
  isSupportedAgentsViewVersion,
  parseAgentsViewOutput,
  parseAgentsViewVersion,
  runAgentsViewRawAsync,
} from "../src/lib/agentsview.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
const mockExecFile = vi.mocked(execFile);
const mockExistsSync = vi.mocked(existsSync);

function agentsViewOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2026-04-12",
        inputTokens: 33410,
        outputTokens: 142805,
        cacheCreationTokens: 301223,
        cacheReadTokens: 2984511,
        totalCost: 9.6052,
        modelsUsed: ["claude-opus-4-6", "gpt-5.1"],
        modelBreakdowns: [
          {
            modelName: "claude-opus-4-6",
            inputTokens: 28102,
            outputTokens: 124901,
            cacheCreationTokens: 287441,
            cacheReadTokens: 2812004,
            cost: 8.4123,
          },
        ],
      },
    ],
    totals: {
      inputTokens: 33410,
      outputTokens: 142805,
      cacheCreationTokens: 301223,
      cacheReadTokens: 2984511,
      totalCost: 9.6052,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetAgentsViewResolver();
  mockExistsSync.mockReturnValue(true);
});

describe("parseAgentsViewOutput", () => {
  it("parses agentsview daily JSON and derives totalTokens when omitted", () => {
    const result = parseAgentsViewOutput(agentsViewOutput());

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      date: "2026-04-12",
      models: ["claude-opus-4-6", "gpt-5.1"],
      inputTokens: 33410,
      outputTokens: 142805,
      cacheCreationTokens: 301223,
      cacheReadTokens: 2984511,
      totalTokens: 3_461_949,
      costUSD: 9.6052,
      reasoningOutputTokens: 0,
      modelBreakdown: [{ model: "claude-opus-4-6", cost_usd: 8.4123 }],
    });
  });

  it("labels parse errors as agentsview errors", () => {
    expect(() => parseAgentsViewOutput("nope")).toThrow("Failed to parse agentsview output as JSON");
    expect(() => parseAgentsViewOutput(JSON.stringify({ daily: "nope" }))).toThrow(
      "Unexpected agentsview output format",
    );
  });
});

describe("runAgentsViewRawAsync", () => {
  it("runs one offline agentsview daily command for all supported agents", async () => {
    mockExecFile.mockImplementation(((_cmd, _args, _options, callback) => {
      callback(null, agentsViewOutput(), "");
      return {} as ReturnType<typeof execFile>;
    }) as typeof execFile);

    const result = await runAgentsViewRawAsync(
      "2026-04-01",
      "2026-04-12",
      10_000,
      { timezone: "America/Vancouver" },
    );

    expect(result).toBe(agentsViewOutput());
    expect(mockExecFile).toHaveBeenCalledWith(
      "agentsview",
      [
        "usage",
        "daily",
        "--json",
        "--breakdown",
        "--offline",
        "--since",
        "2026-04-01",
        "--until",
        "2026-04-12",
        "--timezone",
        "America/Vancouver",
      ],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function),
    );
    expect(mockExecFile.mock.calls[0]?.[1]).not.toContain("--agent");
  });

  it("parses and compares agentsview versions", () => {
    expect(parseAgentsViewVersion("agentsview v0.28.0 (commit abc)")).toBe("0.28.0");
    expect(isSupportedAgentsViewVersion("0.28.0")).toBe(true);
    expect(isSupportedAgentsViewVersion("0.29.0")).toBe(true);
    expect(isSupportedAgentsViewVersion("0.27.0")).toBe(false);
    expect(isSupportedAgentsViewVersion("0.25.0")).toBe(false);
    expect(isSupportedAgentsViewVersion(null)).toBe(false);
  });

  it("captures pre-release and build suffixes and treats RCs as equal to the base version", () => {
    // Pre-release: capture the full `0.28.0-rc.1` string, but compareVersions
    // strips the suffix so it's treated as `0.28.0` (passes the gate).
    expect(parseAgentsViewVersion("agentsview v0.28.0-rc.1")).toBe("0.28.0-rc.1");
    expect(isSupportedAgentsViewVersion("0.28.0-rc.1")).toBe(true);

    // Build metadata: same idea — captured then stripped for comparison.
    expect(parseAgentsViewVersion("agentsview v0.28.0+build.1")).toBe("0.28.0+build.1");
    expect(isSupportedAgentsViewVersion("0.28.0+build.1")).toBe(true);

    // Pre-release of an unsupported version is still unsupported.
    expect(isSupportedAgentsViewVersion("0.27.9-rc.1")).toBe(false);
  });

  it("captures only the X.Y.Z core when a fourth component is present", () => {
    // Documents the deliberate behavior: `0.28.0.1` matches as `0.28.0` (the
    // `\b` boundary stops capture before the `.1`). We accept this — a 4-part
    // version is non-standard and treating it as the leading 3-part version
    // is preferable to crashing.
    expect(parseAgentsViewVersion("agentsview v0.28.0.1")).toBe("0.28.0");
    expect(isSupportedAgentsViewVersion("0.28.0")).toBe(true);
  });

  it("reports availability from PATH without spawning a process", () => {
    mockExistsSync.mockReturnValueOnce(true);

    expect(hasAgentsView()).toBe(true);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("throws a useful installation error when agentsview is missing", async () => {
    mockExistsSync.mockReturnValue(false);

    await expect(runAgentsViewRawAsync("2026-04-01", "2026-04-12")).rejects.toThrow(
      "agentsview is not installed or not on PATH",
    );
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
