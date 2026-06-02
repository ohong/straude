import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCcusageOutput,
  runCcusage,
  runCcusageRaw,
  _resetCcusageResolver,
} from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execFileSync } from "node:child_process";

const mockExecFileSync = vi.mocked(execFileSync);

function claudeOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2026-06-01",
        modelsUsed: ["claude-opus-4-8"],
        inputTokens: 223,
        outputTokens: 9486,
        cacheCreationTokens: 264403,
        cacheReadTokens: 47523,
        totalTokens: 321635,
        totalCost: 1.91454525,
        modelBreakdowns: [
          {
            modelName: "claude-opus-4-8",
            inputTokens: 223,
            outputTokens: 9486,
            cacheCreationTokens: 264403,
            cacheReadTokens: 47523,
            cost: 1.91454525,
          },
        ],
      },
    ],
    totals: {},
  });
}

function codexOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2026-06-01",
        inputTokens: 2217560,
        outputTokens: 156872,
        cachedInputTokens: 34676096,
        reasoningOutputTokens: 58261,
        totalTokens: 37050528,
        costUSD: 33.132008,
        models: {
          "gpt-5.5": {
            inputTokens: 2217560,
            cachedInputTokens: 34676096,
            outputTokens: 156872,
            reasoningOutputTokens: 58261,
            totalTokens: 37050528,
            isFallback: false,
          },
        },
      },
    ],
    totals: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCcusageResolver();
  mockExecFileSync.mockImplementation((_cmd, args) => {
    const argv = Array.isArray(args) ? args.map(String) : [];
    if (argv.includes("--version")) return "ccusage 20.0.6" as never;
    if (argv.includes("claude")) return claudeOutput() as never;
    if (argv.includes("codex")) return codexOutput() as never;
    throw new Error(`unexpected ccusage args: ${argv.join(" ")}`);
  });
});

describe("parseCcusageOutput", () => {
  it("parses source-focused Claude v20 output", () => {
    const result = parseCcusageOutput(claudeOutput(), "claude");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      date: "2026-06-01",
      models: ["claude-opus-4-8"],
      inputTokens: 223,
      outputTokens: 9486,
      cacheCreationTokens: 264403,
      cacheReadTokens: 47523,
      totalTokens: 321635,
      costUSD: 1.91454525,
    });
    expect(result.data[0]!.modelBreakdown).toEqual([
      { model: "claude-opus-4-8", cost_usd: 1.91454525 },
    ]);
    expect(result.rowMetadata).toEqual([
      { date: "2026-06-01", agents: ["claude"] },
    ]);
  });

  it("parses source-focused Codex v20 output with separate cached input semantics", () => {
    const result = parseCcusageOutput(codexOutput(), "codex");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      date: "2026-06-01",
      models: ["gpt-5.5"],
      inputTokens: 2217560,
      outputTokens: 156872,
      cacheCreationTokens: 0,
      cacheReadTokens: 34676096,
      totalTokens: 37050528,
      costUSD: 33.132008,
      reasoningOutputTokens: 58261,
    });
    expect(result.data[0]!.modelBreakdown).toEqual([
      { model: "gpt-5.5", cost_usd: 33.132008 },
    ]);
    expect(result.rowMetadata).toEqual([
      { date: "2026-06-01", agents: ["codex"] },
    ]);
  });

  it("returns empty data for an empty ccusage array", () => {
    expect(parseCcusageOutput("[]", "claude").data).toEqual([]);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json", "claude")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });

  it("rejects output without a daily array", () => {
    expect(() => parseCcusageOutput(JSON.stringify({ totals: {} }), "claude")).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("rejects rows with negative numeric fields", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2026-06-01",
          modelsUsed: [],
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          totalCost: -1,
        },
      ],
    });

    expect(() => parseCcusageOutput(bad, "claude")).toThrow(
      "totalCost must be non-negative",
    );
  });
});

describe("runCcusage", () => {
  it("executes the bundled ccusage package through the current Node runtime", () => {
    const result = runCcusage("claude", "20260601", "20260602");

    expect(result.data).toHaveLength(1);
    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      1,
      process.execPath,
      [expect.stringContaining("ccusage/dist/cli.js"), "--version"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      2,
      process.execPath,
      [
        expect.stringContaining("ccusage/dist/cli.js"),
        "claude",
        "daily",
        "--json",
        "--since",
        "20260601",
        "--until",
        "20260602",
        "--no-offline",
      ],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it("returns raw JSON for the requested agent", () => {
    const result = runCcusageRaw("codex", "20260601", "20260602");

    expect(result).toBe(codexOutput());
  });

  it("reports timeout with the source-focused command hint", () => {
    const err = new Error("killed") as Error & { killed: boolean; signal: string };
    err.killed = true;
    err.signal = "SIGTERM";
    mockExecFileSync.mockImplementation((_cmd, args) => {
      const argv = Array.isArray(args) ? args.map(String) : [];
      if (argv.includes("--version")) return "ccusage 20.0.6" as never;
      throw err;
    });

    expect(() => runCcusage("claude", "20260601", "20260602")).toThrow(
      "ccusage timed out. Try running `ccusage claude daily",
    );
  });

  it("includes stderr detail on failures", () => {
    const err = new Error("fail") as Error & { status: number; stderr: string };
    err.status = 1;
    err.stderr = "Error: invalid date range";
    mockExecFileSync.mockImplementation((_cmd, args) => {
      const argv = Array.isArray(args) ? args.map(String) : [];
      if (argv.includes("--version")) return "ccusage 20.0.6" as never;
      throw err;
    });

    expect(() => runCcusageRaw("codex", "20260601", "20260601")).toThrow(
      "ccusage failed: Error: invalid date range",
    );
  });
});
