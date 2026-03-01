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

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);

/** Build a valid ccusage v18 JSON string. */
function validOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2025-06-01",
        modelsUsed: ["claude-sonnet-4-5-20250514"],
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        cacheReadTokens: 100,
        totalTokens: 1800,
        totalCost: 0.05,
      },
    ],
    totals: {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 200,
      cacheReadTokens: 100,
      totalTokens: 1800,
      totalCost: 0.05,
    },
  });
}

// ---------------------------------------------------------------------------
// parseCcusageOutput
// ---------------------------------------------------------------------------

describe("parseCcusageOutput", () => {
  it("parses valid ccusage v18 JSON and normalizes fields", () => {
    const result = parseCcusageOutput(validOutput());
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
    expect(result.data[0]!.costUSD).toBe(0.05);
    expect(result.data[0]!.models).toEqual(["claude-sonnet-4-5-20250514"]);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });

  it("rejects output without daily array", () => {
    const bad = JSON.stringify({ something: "else" });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("rejects output where daily is not an array", () => {
    const bad = JSON.stringify({ daily: "not an array", totals: {} });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("returns empty data for empty array", () => {
    const result = parseCcusageOutput("[]");
    expect(result.data).toEqual([]);
  });

  it("rejects entry with missing date", () => {
    const bad = JSON.stringify({
      daily: [
        { totalCost: 1, modelsUsed: [], totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with non-numeric cost", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: "not a number",
          modelsUsed: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with negative cost", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: -1,
          modelsUsed: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Negative cost");
  });

  it("rejects entry with negative token counts", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: 1,
          modelsUsed: [],
          totalTokens: -1,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Negative token count");
  });
});

// ---------------------------------------------------------------------------
// runCcusage
// ---------------------------------------------------------------------------

describe("runCcusage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCcusageResolver();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("calls ccusage directly when globally installed", () => {
    // Simulate ccusage binary found on PATH
    mockExistsSync.mockReturnValue(true);

    runCcusage("20250601", "20250601");
    // No --version probe — PATH check is pure fs now
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "ccusage",
      ["daily", "--json", "--breakdown", "--since", "20250601", "--until", "20250601"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it("falls back to package runner when ccusage is not globally installed", () => {
    // ccusage not found on PATH
    mockExistsSync.mockReturnValue(false);

    runCcusage("20250601", "20250601");

    // Single call: npx fallback (process.versions.bun is undefined in Vitest env;
    // bunx path is exercised when the CLI actually runs under bun)
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "npx",
      ["--yes", "ccusage@17", "daily", "--json", "--breakdown", "--since", "20250601", "--until", "20250601"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it("reports timeout when killed", () => {
    const err = new Error("killed") as Error & { killed: boolean; signal: string };
    err.killed = true;
    err.signal = "SIGTERM";
    mockExecFileSync.mockImplementation(() => { throw err; });

    expect(() => runCcusage("20250601", "20250601")).toThrow("timed out");
  });

  it("includes stderr in error when available", () => {
    const err = new Error("fail") as Error & { status: number; stderr: string };
    err.status = 1;
    err.stderr = "Error: no JSONL files found";
    mockExecFileSync.mockImplementation(() => { throw err; });

    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage failed: Error: no JSONL files found",
    );
  });

  it("falls back to error.message when stderr is empty", () => {
    const err = new Error("something went wrong") as Error & { status: number; stderr: string };
    err.status = 1;
    err.stderr = "";
    mockExecFileSync.mockImplementation(() => { throw err; });

    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage failed: something went wrong",
    );
  });
});

// ---------------------------------------------------------------------------
// runCcusageRaw
// ---------------------------------------------------------------------------

describe("runCcusageRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCcusageResolver();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("returns raw JSON string on success", () => {
    const result = runCcusageRaw("20250601", "20250601");
    expect(result).toBe(validOutput());
  });

  it("reports timeout", () => {
    const err = new Error("killed") as Error & { killed: boolean; signal: string };
    err.killed = true;
    err.signal = "SIGTERM";
    mockExecFileSync.mockImplementation(() => { throw err; });

    expect(() => runCcusageRaw("20250601", "20250601")).toThrow("timed out");
  });

  it("includes stderr detail on failure", () => {
    const err = new Error("fail") as Error & { status: number; stderr: string };
    err.status = 1;
    err.stderr = "Error: invalid date range";
    mockExecFileSync.mockImplementation(() => { throw err; });

    expect(() => runCcusageRaw("20250601", "20250601")).toThrow(
      "ccusage failed: Error: invalid date range",
    );
  });
});
