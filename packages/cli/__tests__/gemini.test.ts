import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseGeminiOutput, runGeminiRaw } from "../src/lib/gemini.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

/** Build a valid gemistat JSON string. */
function validOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2025-06-01",
        modelsUsed: ["gemini-2.5-pro"],
        inputTokens: 3000,
        outputTokens: 1000,
        cacheCreationTokens: 200,
        cacheReadTokens: 500,
        totalCost: 0.15,
      },
    ],
    totals: {
      inputTokens: 3000,
      outputTokens: 1000,
      cacheCreationTokens: 200,
      cacheReadTokens: 500,
      totalCost: 0.15,
    },
  });
}

// ---------------------------------------------------------------------------
// parseGeminiOutput
// ---------------------------------------------------------------------------

describe("parseGeminiOutput", () => {
  it("parses valid gemistat JSON and normalizes fields", () => {
    const result = parseGeminiOutput(validOutput());
    expect(result.data).toHaveLength(1);
    const entry = result.data[0]!;
    expect(entry.date).toBe("2025-06-01");
    expect(entry.costUSD).toBe(0.15);
    expect(entry.models).toEqual(["gemini-2.5-pro"]);
    expect(entry.inputTokens).toBe(3000);
    expect(entry.outputTokens).toBe(1000);
    expect(entry.cacheCreationTokens).toBe(200);
    expect(entry.cacheReadTokens).toBe(500);
    // totalTokens = input + output + cacheCreation + cacheRead
    expect(entry.totalTokens).toBe(4700);
  });

  it("parses multi-model output", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          modelsUsed: ["gemini-2.5-pro", "gemini-2.5-flash"],
          inputTokens: 5000,
          outputTokens: 2000,
          totalCost: 0.25,
        },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.models).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
  });

  it("returns empty data for invalid JSON (with anomaly)", () => {
    const result = parseGeminiOutput("not json");
    expect(result.data).toEqual([]);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies?.[0]?.mode).toBe("unresolved");
    expect(result.anomalies?.[0]?.source).toBe("gemini");
    expect(result.normalizationSummary?.anomalies).toBe(1);
  });

  it("returns empty data for empty array", () => {
    const result = parseGeminiOutput("[]");
    expect(result.data).toEqual([]);
  });

  it("returns empty data when daily is missing", () => {
    const result = parseGeminiOutput(JSON.stringify({ something: "else" }));
    expect(result.data).toEqual([]);
  });

  it("filters out entries with missing date", () => {
    const raw = JSON.stringify({
      daily: [
        { totalCost: 1, modelsUsed: [], inputTokens: 0, outputTokens: 0 },
        { date: "2025-06-01", totalCost: 0.05, modelsUsed: ["gemini-2.5-pro"], inputTokens: 50, outputTokens: 50 },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
  });

  it("filters out entries with negative cost", () => {
    const raw = JSON.stringify({
      daily: [
        { date: "2025-06-01", totalCost: -1, modelsUsed: [], inputTokens: 0, outputTokens: 0 },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data).toEqual([]);
  });

  it("handles entries without cache tokens", () => {
    const raw = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          modelsUsed: ["gemini-2.5-flash"],
          inputTokens: 500,
          outputTokens: 200,
          totalCost: 0.03,
        },
      ],
      totals: {},
    });
    const result = parseGeminiOutput(raw);
    expect(result.data[0]!.cacheCreationTokens).toBe(0);
    expect(result.data[0]!.cacheReadTokens).toBe(0);
    expect(result.data[0]!.totalTokens).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// runGeminiRaw — silent failure
// ---------------------------------------------------------------------------

describe("runGeminiRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue(validOutput() as never);
  });

  it("returns raw JSON string on success", () => {
    const result = runGeminiRaw("20250601", "20250601");
    expect(result).toBe(validOutput());
  });

  it("converts compact YYYYMMDD dates to ISO YYYY-MM-DD for gemistat", () => {
    runGeminiRaw("20250601", "20250607");
    const args = mockExecFileSync.mock.calls[0]![1] as string[];
    // gemistat expects YYYY-MM-DD, not YYYYMMDD
    expect(args).toContain("2025-06-01");
    expect(args).toContain("2025-06-07");
    expect(args).not.toContain("20250601");
    expect(args).not.toContain("20250607");
  });

  it("passes through already-ISO dates unchanged", () => {
    runGeminiRaw("2025-06-01", "2025-06-07");
    const args = mockExecFileSync.mock.calls[0]![1] as string[];
    expect(args).toContain("2025-06-01");
    expect(args).toContain("2025-06-07");
  });

  it("returns empty string on failure (silent)", () => {
    mockExecFileSync.mockImplementation(() => { throw new Error("fail"); });
    const result = runGeminiRaw("20250601", "20250601");
    expect(result).toBe("");
  });
});
