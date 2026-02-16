import { describe, it, expect, vi } from "vitest";
import { parseCcusageOutput, runCcusage } from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

function validOutput() {
  return JSON.stringify({
    type: "daily",
    data: [
      {
        date: "2025-06-01",
        models: ["claude-sonnet-4-5-20250514"],
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        cacheReadTokens: 100,
        totalTokens: 1800,
        costUSD: 0.05,
      },
    ],
    summary: {
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCacheCreationTokens: 200,
      totalCacheReadTokens: 100,
      totalTokens: 1800,
      totalCostUSD: 0.05,
    },
  });
}

describe("parseCcusageOutput", () => {
  it("parses valid ccusage JSON", () => {
    const result = parseCcusageOutput(validOutput());
    expect(result.type).toBe("daily");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
    expect(result.data[0]!.costUSD).toBe(0.05);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });

  it("rejects output with wrong type", () => {
    const bad = JSON.stringify({ type: "monthly", data: [] });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("rejects output without data array", () => {
    const bad = JSON.stringify({ type: "daily", data: "not an array" });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("rejects entry with missing date", () => {
    const bad = JSON.stringify({
      type: "daily",
      data: [{ costUSD: 1, totalTokens: 0, inputTokens: 0, outputTokens: 0 }],
      summary: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with non-numeric costUSD", () => {
    const bad = JSON.stringify({
      type: "daily",
      data: [
        {
          date: "2025-06-01",
          costUSD: "not a number",
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
        },
      ],
      summary: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with negative cost", () => {
    const bad = JSON.stringify({
      type: "daily",
      data: [
        {
          date: "2025-06-01",
          costUSD: -1,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
        },
      ],
      summary: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Negative cost");
  });

  it("rejects entry with negative token counts", () => {
    const bad = JSON.stringify({
      type: "daily",
      data: [
        {
          date: "2025-06-01",
          costUSD: 1,
          totalTokens: -1,
          inputTokens: 0,
          outputTokens: 0,
        },
      ],
      summary: {},
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
