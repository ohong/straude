import { describe, it, expect, vi } from "vitest";
import { parseCcusageOutput, runCcusage } from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

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

describe("runCcusage", () => {
  it("calls execFileSync with correct arguments", () => {
    mockExecFileSync.mockReturnValue(validOutput());
    runCcusage("20250601", "20250601");
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "ccusage",
      ["daily", "--json", "--since", "20250601", "--until", "20250601"],
      expect.objectContaining({ encoding: "utf-8", timeout: 30_000 }),
    );
  });

  it("throws descriptive error when ccusage is not installed", () => {
    mockExecFileSync.mockImplementation(() => {
      const err = new Error("command not found") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 127;
      err.stderr = "";
      throw err;
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("throws on other ccusage failures", () => {
    mockExecFileSync.mockImplementation(() => {
      const err = new Error("fail") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 1;
      err.stderr = "some error";
      throw err;
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow("ccusage failed");
  });
});
