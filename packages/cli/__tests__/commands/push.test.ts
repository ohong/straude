import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/auth.js", () => ({
  requireAuth: vi.fn(),
  updateLastPushDate: vi.fn(),
}));

vi.mock("../../src/lib/api.js", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../src/lib/ccusage.js", () => ({
  runCcusageRaw: vi.fn(),
  parseCcusageOutput: vi.fn(),
}));

vi.mock("../../src/lib/codex.js", () => ({
  runCodexRaw: vi.fn(),
  parseCodexOutput: vi.fn(),
}));

import { pushCommand, mergeEntries } from "../../src/commands/push.js";
import { requireAuth } from "../../src/lib/auth.js";
import { apiRequest } from "../../src/lib/api.js";
import { runCcusageRaw, parseCcusageOutput } from "../../src/lib/ccusage.js";
import { runCodexRaw, parseCodexOutput } from "../../src/lib/codex.js";

const mockRequireAuth = vi.mocked(requireAuth);
const mockApiRequest = vi.mocked(apiRequest);
const mockRunCcusageRaw = vi.mocked(runCcusageRaw);
const mockParseCcusageOutput = vi.mocked(parseCcusageOutput);
const mockRunCodexRaw = vi.mocked(runCodexRaw);
const mockParseCodexOutput = vi.mocked(parseCodexOutput);

const fakeConfig = { token: "tok", username: "alice", api_url: "https://straude.com" };

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockReturnValue(fakeConfig);
  // Default: no Codex data
  mockRunCodexRaw.mockReturnValue("");
  mockParseCodexOutput.mockReturnValue({ data: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pushCommand", () => {
  it("dry-run prints summary without API call", async () => {
    mockRunCcusageRaw.mockReturnValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: todayStr(),
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 1500,
          costUSD: 0.05,
        },
      ],
    });

    await pushCommand({ dryRun: true });

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("dry run"),
    );
  });

  it("submits today's data and prints post URL", async () => {
    const today = todayStr();

    mockRunCcusageRaw.mockReturnValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 1500,
          costUSD: 0.05,
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1" },
      ],
    });

    await pushCommand({});

    expect(mockApiRequest).toHaveBeenCalledWith(
      fakeConfig,
      "/api/usage/submit",
      expect.objectContaining({ method: "POST" }),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("https://straude.com/post/p-1"),
    );
  });

  it("handles empty ccusage output", async () => {
    mockRunCcusageRaw.mockReturnValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No usage data found"),
    );
  });

  it("rejects future dates", async () => {
    await expect(pushCommand({ date: "2099-01-01" })).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("rejects dates outside backfill window", async () => {
    await expect(pushCommand({ date: "2020-01-01" })).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("handles API submission failure", async () => {
    mockRunCcusageRaw.mockReturnValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: todayStr(),
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 1500,
          costUSD: 0.05,
        },
      ],
    });

    mockApiRequest.mockRejectedValue(new Error("Server error"));

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("passes --date option correctly", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, "0");
    const d = String(yesterday.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const compactStr = `${y}${m}${d}`;

    mockRunCcusageRaw.mockReturnValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({ date: dateStr });

    expect(mockRunCcusageRaw).toHaveBeenCalledWith(compactStr, compactStr);
  });

  it("passes --days option correctly", async () => {
    mockRunCcusageRaw.mockReturnValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({ days: 3 });

    expect(mockRunCcusageRaw).toHaveBeenCalledTimes(1);
    const [sinceArg, untilArg] = mockRunCcusageRaw.mock.calls[0]!;
    const today = new Date();
    const todayCompact = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    expect(untilArg).toBe(todayCompact);
    expect(sinceArg).not.toBe(untilArg);
  });

  it("merges Claude + Codex data for the same day", async () => {
    const today = todayStr();

    mockRunCcusageRaw.mockReturnValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-opus-4-20250505"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 100,
          cacheReadTokens: 50,
          totalTokens: 1650,
          costUSD: 10.0,
        },
      ],
    });

    mockRunCodexRaw.mockReturnValue('{"daily":[]}');
    mockParseCodexOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["gpt-5-codex"],
          inputTokens: 2000,
          outputTokens: 800,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 2800,
          costUSD: 3.0,
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    // Verify merged data was submitted
    const submitCall = mockApiRequest.mock.calls[0]!;
    const body = JSON.parse(submitCall[2]!.body as string);
    const entry = body.entries[0].data;

    expect(entry.costUSD).toBe(13.0);
    expect(entry.totalTokens).toBe(4450);
    expect(entry.inputTokens).toBe(3000);
    expect(entry.outputTokens).toBe(1300);
    expect(entry.models).toContain("claude-opus-4-20250505");
    expect(entry.models).toContain("gpt-5-codex");
    expect(entry.modelBreakdown).toHaveLength(2);
    expect(entry.modelBreakdown[0]).toEqual({ model: "claude-opus-4-20250505", cost_usd: 10.0 });
    expect(entry.modelBreakdown[1]).toEqual({ model: "gpt-5-codex", cost_usd: 3.0 });
  });

  it("proceeds with Claude data only when Codex fails", async () => {
    const today = todayStr();

    mockRunCcusageRaw.mockReturnValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 1500,
          costUSD: 0.05,
        },
      ],
    });

    // Codex fails silently
    mockRunCodexRaw.mockReturnValue("");
    mockParseCodexOutput.mockReturnValue({ data: [] });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    // Should still submit
    expect(mockApiRequest).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// mergeEntries
// ---------------------------------------------------------------------------

describe("mergeEntries", () => {
  it("merges entries for the same date", () => {
    const claude = [{
      date: "2025-06-01",
      models: ["claude-opus-4-20250505"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 100, cacheReadTokens: 50,
      totalTokens: 1650, costUSD: 10.0,
    }];
    const codex = [{
      date: "2025-06-01",
      models: ["gpt-5-codex"],
      inputTokens: 2000, outputTokens: 800,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 2800, costUSD: 3.0,
    }];

    const merged = mergeEntries(claude, codex);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.costUSD).toBe(13.0);
    expect(merged[0]!.totalTokens).toBe(4450);
    expect(merged[0]!.models).toEqual(["claude-opus-4-20250505", "gpt-5-codex"]);
    expect(merged[0]!.modelBreakdown).toEqual([
      { model: "claude-opus-4-20250505", cost_usd: 10.0 },
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ]);
  });

  it("keeps separate entries for different dates", () => {
    const claude = [{
      date: "2025-06-01",
      models: ["claude-opus-4-20250505"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 1500, costUSD: 5.0,
    }];
    const codex = [{
      date: "2025-06-02",
      models: ["gpt-5-codex"],
      inputTokens: 2000, outputTokens: 800,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 2800, costUSD: 3.0,
    }];

    const merged = mergeEntries(claude, codex);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.date).toBe("2025-06-01");
    expect(merged[0]!.costUSD).toBe(5.0);
    expect(merged[1]!.date).toBe("2025-06-02");
    expect(merged[1]!.costUSD).toBe(3.0);
  });

  it("handles Claude-only days", () => {
    const claude = [{
      date: "2025-06-01",
      models: ["claude-sonnet-4-20250514"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 1500, costUSD: 0.05,
    }];

    const merged = mergeEntries(claude, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.costUSD).toBe(0.05);
    expect(merged[0]!.modelBreakdown).toEqual([
      { model: "claude-sonnet-4-20250514", cost_usd: 0.05 },
    ]);
  });

  it("handles Codex-only days", () => {
    const codex = [{
      date: "2025-06-01",
      models: ["gpt-5-codex"],
      inputTokens: 2000, outputTokens: 800,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 2800, costUSD: 3.0,
    }];

    const merged = mergeEntries([], codex);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.costUSD).toBe(3.0);
    expect(merged[0]!.modelBreakdown).toEqual([
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ]);
  });

  it("distributes cost evenly across multiple models from same source", () => {
    const claude = [{
      date: "2025-06-01",
      models: ["claude-opus-4-20250505", "claude-sonnet-4-20250514"],
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 1500, costUSD: 10.0,
    }];

    const merged = mergeEntries(claude, []);
    expect(merged[0]!.modelBreakdown).toEqual([
      { model: "claude-opus-4-20250505", cost_usd: 5.0 },
      { model: "claude-sonnet-4-20250514", cost_usd: 5.0 },
    ]);
  });

  it("returns sorted by date", () => {
    const claude = [{
      date: "2025-06-03",
      models: ["claude-opus-4-20250505"],
      inputTokens: 0, outputTokens: 0,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 0, costUSD: 1.0,
    }];
    const codex = [{
      date: "2025-06-01",
      models: ["gpt-5-codex"],
      inputTokens: 0, outputTokens: 0,
      cacheCreationTokens: 0, cacheReadTokens: 0,
      totalTokens: 0, costUSD: 2.0,
    }];

    const merged = mergeEntries(claude, codex);
    expect(merged[0]!.date).toBe("2025-06-01");
    expect(merged[1]!.date).toBe("2025-06-03");
  });

  it("handles both sources empty", () => {
    const merged = mergeEntries([], []);
    expect(merged).toEqual([]);
  });
});
