import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCodexOutput, runCodex, runCodexRaw } from "../src/lib/codex.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

/** Build a valid @ccusage/codex JSON string. */
function validOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2025-06-01",
        modelsUsed: ["gpt-5-codex"],
        inputTokens: 2000,
        outputTokens: 800,
        totalTokens: 2800,
        totalCost: 0.12,
      },
    ],
    totals: {
      inputTokens: 2000,
      outputTokens: 800,
      totalTokens: 2800,
      totalCost: 0.12,
    },
  });
}

/** Build a real @ccusage/codex JSON string (actual output format). */
function realCodexOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "Feb 03, 2026",
        inputTokens: 8247567,
        cachedInputTokens: 7428352,
        outputTokens: 42769,
        reasoningOutputTokens: 32128,
        totalTokens: 8290336,
        costUSD: 3.33,
        models: {
          "gpt-5.2-codex": {
            inputTokens: 8247567,
            cachedInputTokens: 7428352,
            outputTokens: 42769,
            reasoningOutputTokens: 32128,
            totalTokens: 8290336,
            isFallback: false,
          },
        },
      },
    ],
    totals: {
      inputTokens: 8247567,
      cachedInputTokens: 7428352,
      outputTokens: 42769,
      totalTokens: 8290336,
      costUSD: 3.33,
    },
  });
}

// ---------------------------------------------------------------------------
// parseCodexOutput
// ---------------------------------------------------------------------------

describe("parseCodexOutput", () => {
  it("parses real @ccusage/codex output format", () => {
    const result = parseCodexOutput(realCodexOutput());
    expect(result.data).toHaveLength(1);
    const entry = result.data[0]!;
    expect(entry.date).toBe("2026-02-03");
    expect(entry.costUSD).toBe(3.33);
    expect(entry.models).toEqual(["gpt-5.2-codex"]);
    expect(entry.inputTokens).toBe(8247567);
    expect(entry.outputTokens).toBe(42769);
    expect(entry.totalTokens).toBe(8290336);
    // cachedInputTokens maps to cacheReadTokens in our canonical format
    expect(entry.cacheReadTokens).toBe(7428352);
    expect(entry.cacheCreationTokens).toBe(0);
  });

  it("parses valid Codex JSON and normalizes fields", () => {
    const result = parseCodexOutput(validOutput());
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
    expect(result.data[0]!.costUSD).toBe(0.12);
    expect(result.data[0]!.models).toEqual(["gpt-5-codex"]);
    expect(result.data[0]!.cacheCreationTokens).toBe(0);
    expect(result.data[0]!.cacheReadTokens).toBe(0);
  });

  it("returns empty data for invalid JSON", () => {
    const result = parseCodexOutput("not json");
    expect(result.data).toEqual([]);
  });

  it("returns empty data for empty array", () => {
    const result = parseCodexOutput("[]");
    expect(result.data).toEqual([]);
  });

  it("returns empty data when daily is missing", () => {
    const result = parseCodexOutput(JSON.stringify({ something: "else" }));
    expect(result.data).toEqual([]);
  });

  it("filters out entries with missing date", () => {
    const raw = JSON.stringify({
      daily: [
        { totalCost: 1, modelsUsed: [], totalTokens: 0, inputTokens: 0, outputTokens: 0 },
        { date: "2025-06-01", totalCost: 0.05, modelsUsed: ["gpt-5-codex"], totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      ],
      totals: {},
    });
    const result = parseCodexOutput(raw);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
  });

  it("filters out entries with negative cost", () => {
    const raw = JSON.stringify({
      daily: [
        { date: "2025-06-01", totalCost: -1, modelsUsed: [], totalTokens: 0, inputTokens: 0, outputTokens: 0 },
      ],
      totals: {},
    });
    const result = parseCodexOutput(raw);
    expect(result.data).toEqual([]);
  });

  it("handles entries without cache tokens", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          modelsUsed: ["gpt-4o-2025-01-01"],
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          totalCost: 0.03,
        },
      ],
      totals: {},
    });
    const result = parseCodexOutput(raw);
    expect(result.data[0]!.cacheCreationTokens).toBe(0);
    expect(result.data[0]!.cacheReadTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runCodex / runCodexRaw — silent failure
// ---------------------------------------------------------------------------

describe("runCodex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("returns parsed data on success", () => {
    const result = runCodex("20250601", "20250601");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.costUSD).toBe(0.12);
  });

  it("returns empty data on exec failure (silent)", () => {
    mockExecFileSync.mockImplementation(() => { throw new Error("command not found"); });
    const result = runCodex("20250601", "20250601");
    expect(result.data).toEqual([]);
  });

  it("returns empty data on timeout (silent)", () => {
    const err = new Error("killed") as Error & { killed: boolean; signal: string };
    err.killed = true;
    err.signal = "SIGTERM";
    mockExecFileSync.mockImplementation(() => { throw err; });
    const result = runCodex("20250601", "20250601");
    expect(result.data).toEqual([]);
  });

  it("uses npx in non-bun environment", () => {
    runCodex("20250601", "20250601");
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "npx",
      ["--yes", "@ccusage/codex@latest", "daily", "--json", "--since", "20250601", "--until", "20250601"],
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });
});

describe("runCodexRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("returns raw JSON string on success", () => {
    const result = runCodexRaw("20250601", "20250601");
    expect(result).toBe(validOutput());
  });

  it("returns empty string on failure (silent)", () => {
    mockExecFileSync.mockImplementation(() => { throw new Error("fail"); });
    const result = runCodexRaw("20250601", "20250601");
    expect(result).toBe("");
  });
});
