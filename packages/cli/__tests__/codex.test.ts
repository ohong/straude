import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseCodexOutput, runCodexRaw } from "../src/lib/codex.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
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
    // inputTokens excludes cachedInputTokens (8247567 - 7428352 = 819215)
    expect(entry.inputTokens).toBe(819215);
    expect(entry.outputTokens).toBe(42769);
    expect(entry.totalTokens).toBe(8290336);
    // cachedInputTokens maps to cacheReadTokens in our canonical format
    expect(entry.cacheReadTokens).toBe(7428352);
    expect(entry.cacheCreationTokens).toBe(0);
    // Single model gets 100% of cost
    expect(entry.modelBreakdown).toEqual([
      { model: "gpt-5.2-codex", cost_usd: 3.33 },
    ]);
  });

  it("distributes cost proportionally across multiple models by token share", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2026-04-07",
          inputTokens: 400000,
          outputTokens: 20000,
          totalTokens: 420000,
          costUSD: 10.0,
          models: {
            "gpt-5.4": {
              inputTokens: 300000,
              outputTokens: 15000,
              totalTokens: 315000,
            },
            "gpt-5.4-mini": {
              inputTokens: 100000,
              outputTokens: 5000,
              totalTokens: 105000,
            },
          },
        },
      ],
    });
    const result = parseCodexOutput(raw);
    expect(result.data).toHaveLength(1);
    const entry = result.data[0]!;
    // 315000/420000 = 75% → $7.50, 105000/420000 = 25% → $2.50
    expect(entry.modelBreakdown).toHaveLength(2);
    expect(entry.modelBreakdown![0]!.model).toBe("gpt-5.4");
    expect(entry.modelBreakdown![0]!.cost_usd).toBeCloseTo(7.5);
    expect(entry.modelBreakdown![1]!.model).toBe("gpt-5.4-mini");
    expect(entry.modelBreakdown![1]!.cost_usd).toBeCloseTo(2.5);
  });

  it("parses valid Codex JSON and normalizes fields", () => {
    const result = parseCodexOutput(validOutput());
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
    expect(result.data[0]!.costUSD).toBe(0.12);
    expect(result.data[0]!.models).toEqual(["gpt-5-codex"]);
    expect(result.data[0]!.cacheCreationTokens).toBe(0);
    expect(result.data[0]!.cacheReadTokens).toBe(0);
    // Legacy format (modelsUsed string array) has no per-model tokens
    expect(result.data[0]!.modelBreakdown).toBeUndefined();
  });

  it("returns empty data for invalid JSON", () => {
    const result = parseCodexOutput("not json");
    expect(result.data).toEqual([]);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies?.[0]?.mode).toBe("unresolved");
    expect(result.normalizationSummary?.anomalies).toBe(1);
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

  it("uses pass-through mode when codex JSON already separates cache read", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2026-03-01",
          inputTokens: 144461,
          cacheReadTokens: 3161216,
          outputTokens: 27407,
          totalTokens: 3333084,
          costUSD: 1.18,
          models: { "gpt-5.3-codex": {} },
        },
      ],
    });

    const result = parseCodexOutput(raw);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.inputTokens).toBe(144461);
    expect(result.data[0]!.cacheReadTokens).toBe(3161216);
    expect(result.normalizationSummary?.byMode.pass_through_normalized).toBe(1);
    expect(result.anomalies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runCodexRaw — silent failure
// ---------------------------------------------------------------------------

describe("runCodexRaw", () => {
  const originalCodexPkg = process.env.STRAUDE_CODEX_PKG;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRAUDE_CODEX_PKG;
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  afterEach(() => {
    if (originalCodexPkg === undefined) {
      delete process.env.STRAUDE_CODEX_PKG;
    } else {
      process.env.STRAUDE_CODEX_PKG = originalCodexPkg;
    }
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

  it("uses STRAUDE_CODEX_PKG when set", () => {
    process.env.STRAUDE_CODEX_PKG = "@maxghenis/ccusage-codex@patched";

    runCodexRaw("20250601", "20250601");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["@maxghenis/ccusage-codex@patched", "daily", "--json"]),
      expect.any(Object),
    );
  });
});
