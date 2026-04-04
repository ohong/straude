import { describe, it, expect } from "vitest";
import { mergeEntries } from "../src/commands/push.js";
import type { CcusageDailyEntry } from "../src/lib/ccusage.js";

function makeEntry(overrides: Partial<CcusageDailyEntry> & { date: string }): CcusageDailyEntry {
  return {
    models: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    costUSD: 0,
    ...overrides,
  };
}

describe("mergeEntries", () => {
  it("3-way merge sums costs, unions models, sums tokens", () => {
    const claude = [makeEntry({
      date: "2025-06-01",
      models: ["claude-sonnet-4-20250514"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 100,
      cacheReadTokens: 200,
      totalTokens: 1800,
      costUSD: 0.10,
    })];
    const codex = [makeEntry({
      date: "2025-06-01",
      models: ["gpt-5-codex"],
      inputTokens: 2000,
      outputTokens: 800,
      cacheCreationTokens: 50,
      cacheReadTokens: 100,
      totalTokens: 2950,
      costUSD: 0.20,
    })];
    const gemini = [makeEntry({
      date: "2025-06-01",
      models: ["gemini-2.5-pro"],
      inputTokens: 3000,
      outputTokens: 1000,
      cacheCreationTokens: 200,
      cacheReadTokens: 500,
      totalTokens: 4700,
      costUSD: 0.15,
    })];

    const merged = mergeEntries(claude, codex, gemini);
    expect(merged).toHaveLength(1);
    const entry = merged[0]!;

    expect(entry.date).toBe("2025-06-01");
    expect(entry.models).toEqual(["claude-sonnet-4-20250514", "gpt-5-codex", "gemini-2.5-pro"]);
    expect(entry.inputTokens).toBe(6000);
    expect(entry.outputTokens).toBe(2300);
    expect(entry.cacheCreationTokens).toBe(350);
    expect(entry.cacheReadTokens).toBe(800);
    expect(entry.totalTokens).toBe(9450);
    expect(entry.costUSD).toBeCloseTo(0.45);
  });

  it("gemini-only dates work", () => {
    const gemini = [makeEntry({
      date: "2025-06-02",
      models: ["gemini-2.5-flash"],
      inputTokens: 500,
      outputTokens: 200,
      totalTokens: 700,
      costUSD: 0.03,
    })];

    const merged = mergeEntries([], [], gemini);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.date).toBe("2025-06-02");
    expect(merged[0]!.models).toEqual(["gemini-2.5-flash"]);
    expect(merged[0]!.costUSD).toBe(0.03);
  });

  it("backward compatible without gemini argument", () => {
    const claude = [makeEntry({
      date: "2025-06-01",
      models: ["claude-sonnet-4-20250514"],
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costUSD: 0.10,
    })];
    const codex = [makeEntry({
      date: "2025-06-01",
      models: ["gpt-5-codex"],
      inputTokens: 2000,
      outputTokens: 800,
      totalTokens: 2800,
      costUSD: 0.20,
    })];

    // Call without 3rd argument — backward compatible
    const merged = mergeEntries(claude, codex);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.models).toEqual(["claude-sonnet-4-20250514", "gpt-5-codex"]);
    expect(merged[0]!.costUSD).toBeCloseTo(0.30);
    expect(merged[0]!.totalTokens).toBe(4300);
  });
});
