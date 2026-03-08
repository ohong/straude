import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/auth.js", () => ({
  loadConfig: vi.fn(),
  updateLastPushDate: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock("../../src/commands/login.js", () => ({
  loginCommand: vi.fn(),
}));

vi.mock("../../src/lib/api.js", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../src/lib/ccusage.js", () => ({
  runCcusageRawAsync: vi.fn(),
  parseCcusageOutput: vi.fn(),
}));

vi.mock("../../src/lib/codex.js", () => ({
  runCodexRawAsync: vi.fn(),
  parseCodexOutput: vi.fn(),
}));

vi.mock("../../src/lib/gemini.js", () => ({
  runGeminiRawAsync: vi.fn(),
  parseGeminiOutput: vi.fn(),
}));

vi.mock("../../src/lib/qwen.js", () => ({
  runQwenRawAsync: vi.fn(),
  parseQwenOutput: vi.fn(),
}));

vi.mock("../../src/lib/mistral.js", () => ({
  runMistralRawAsync: vi.fn(),
  parseMistralOutput: vi.fn(),
}));

import { pushCommand, mergeEntries } from "../../src/commands/push.js";
import { loadConfig, saveConfig } from "../../src/lib/auth.js";
import { loginCommand } from "../../src/commands/login.js";
import { apiRequest } from "../../src/lib/api.js";
import { runCcusageRawAsync, parseCcusageOutput } from "../../src/lib/ccusage.js";
import { runCodexRawAsync, parseCodexOutput } from "../../src/lib/codex.js";
import { runGeminiRawAsync, parseGeminiOutput } from "../../src/lib/gemini.js";
import { runQwenRawAsync, parseQwenOutput } from "../../src/lib/qwen.js";
import { runMistralRawAsync, parseMistralOutput } from "../../src/lib/mistral.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockLoginCommand = vi.mocked(loginCommand);
const mockSaveConfig = vi.mocked(saveConfig);
const mockApiRequest = vi.mocked(apiRequest);
const mockRunCcusageRawAsync = vi.mocked(runCcusageRawAsync);
const mockParseCcusageOutput = vi.mocked(parseCcusageOutput);
const mockRunCodexRawAsync = vi.mocked(runCodexRawAsync);
const mockParseCodexOutput = vi.mocked(parseCodexOutput);
const mockRunGeminiRawAsync = vi.mocked(runGeminiRawAsync);
const mockParseGeminiOutput = vi.mocked(parseGeminiOutput);
const mockRunQwenRawAsync = vi.mocked(runQwenRawAsync);
const mockParseQwenOutput = vi.mocked(parseQwenOutput);
const mockRunMistralRawAsync = vi.mocked(runMistralRawAsync);
const mockParseMistralOutput = vi.mocked(parseMistralOutput);

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
  mockLoadConfig.mockReturnValue(fakeConfig);
  // Default: no Codex/Gemini/Qwen/Mistral data
  mockRunCodexRawAsync.mockResolvedValue("");
  mockParseCodexOutput.mockReturnValue({ data: [] });
  mockRunGeminiRawAsync.mockResolvedValue("");
  mockParseGeminiOutput.mockReturnValue({ data: [] });
  mockRunQwenRawAsync.mockResolvedValue("");
  mockParseQwenOutput.mockReturnValue({ data: [] });
  mockRunMistralRawAsync.mockResolvedValue("");
  mockParseMistralOutput.mockReturnValue({ data: [] });
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
    mockRunCcusageRawAsync.mockResolvedValue("{}");
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

    mockRunCcusageRawAsync.mockResolvedValue("{}");
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
    mockRunCcusageRawAsync.mockResolvedValue("[]");
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
    mockRunCcusageRawAsync.mockResolvedValue("{}");
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

    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({ date: dateStr });

    expect(mockRunCcusageRawAsync).toHaveBeenCalledWith(compactStr, compactStr);
  });

  it("passes --days option correctly", async () => {
    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({ days: 3 });

    expect(mockRunCcusageRawAsync).toHaveBeenCalledTimes(1);
    const [sinceArg, untilArg] = mockRunCcusageRawAsync.mock.calls[0]!;
    const today = new Date();
    const todayCompact = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    expect(untilArg).toBe(todayCompact);
    expect(sinceArg).not.toBe(untilArg);
  });

  it("merges Claude + Codex data for the same day", async () => {
    const today = todayStr();

    mockRunCcusageRawAsync.mockResolvedValue("{}");
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

    mockRunCodexRawAsync.mockResolvedValue('{"daily":[]}');
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

  it("generates device_id on first push and persists to config", async () => {
    const today = todayStr();
    // Config without device_id
    const configWithoutDevice = { token: "tok", username: "alice", api_url: "https://straude.com" };
    mockLoadConfig.mockReturnValue(configWithoutDevice);

    mockRunCcusageRawAsync.mockResolvedValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000, outputTokens: 500,
          cacheCreationTokens: 0, cacheReadTokens: 0,
          totalTokens: 1500, costUSD: 0.05,
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    // saveConfig should have been called with the generated device_id
    expect(mockSaveConfig).toHaveBeenCalled();
    const savedConfig = mockSaveConfig.mock.calls[0]![0];
    expect(savedConfig.device_id).toBeDefined();
    expect(savedConfig.device_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(savedConfig.device_name).toBeDefined();

    // device_id should be included in the API request body
    const submitCall = mockApiRequest.mock.calls[0]!;
    const body = JSON.parse(submitCall[2]!.body as string);
    expect(body.device_id).toBe(savedConfig.device_id);
    expect(body.device_name).toBe(savedConfig.device_name);
  });

  it("reuses existing device_id (does not regenerate)", async () => {
    const today = todayStr();
    const existingDeviceId = "11111111-2222-3333-4444-555555555555";
    mockLoadConfig.mockReturnValue({
      token: "tok", username: "alice", api_url: "https://straude.com",
      device_id: existingDeviceId, device_name: "my-desktop",
    });

    mockRunCcusageRawAsync.mockResolvedValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000, outputTokens: 500,
          cacheCreationTokens: 0, cacheReadTokens: 0,
          totalTokens: 1500, costUSD: 0.05,
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    // saveConfig should NOT have been called (device_id already existed)
    expect(mockSaveConfig).not.toHaveBeenCalled();

    // Existing device_id should be in the API request
    const submitCall = mockApiRequest.mock.calls[0]!;
    const body = JSON.parse(submitCall[2]!.body as string);
    expect(body.device_id).toBe(existingDeviceId);
    expect(body.device_name).toBe("my-desktop");
  });

  it("includes device_id and device_name in API request body", async () => {
    const today = todayStr();
    mockLoadConfig.mockReturnValue({
      token: "tok", username: "alice", api_url: "https://straude.com",
      device_id: "aaaa-bbbb-cccc-dddd", device_name: "work-laptop",
    });

    mockRunCcusageRawAsync.mockResolvedValue("{}");
    mockParseCcusageOutput.mockReturnValue({
      data: [
        {
          date: today,
          models: ["claude-sonnet-4-5-20250929"],
          inputTokens: 1000, outputTokens: 500,
          cacheCreationTokens: 0, cacheReadTokens: 0,
          totalTokens: 1500, costUSD: 0.05,
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    const submitCall = mockApiRequest.mock.calls[0]!;
    const body = JSON.parse(submitCall[2]!.body as string);
    expect(body.device_id).toBe("aaaa-bbbb-cccc-dddd");
    expect(body.device_name).toBe("work-laptop");
    expect(body.source).toBe("cli");
    expect(body.entries).toHaveLength(1);
  });

  it("proceeds with Claude data only when Codex fails", async () => {
    const today = todayStr();

    mockRunCcusageRawAsync.mockResolvedValue("{}");
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
    mockRunCodexRawAsync.mockResolvedValue("");
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

  it("skips unresolved codex rows without dropping Claude rows on the same date", async () => {
    const today = todayStr();

    mockRunCcusageRawAsync.mockResolvedValue("{}");
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

    mockRunCodexRawAsync.mockResolvedValue('{"daily":[]}');
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
      anomalies: [
        {
          date: today,
          source: "codex",
          mode: "unresolved",
          confidence: "low",
          consistencyError: 42,
          warnings: ["Unable to infer split"],
        },
      ],
      entryMeta: [
        {
          date: today,
          meta: {
            mode: "unresolved",
            confidence: "low",
            warnings: ["Unable to infer split"],
            consistencyError: 42,
          },
        },
      ],
    });

    mockApiRequest.mockResolvedValue({
      results: [
        { date: today, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    });

    await pushCommand({});

    const submitCall = mockApiRequest.mock.calls[0]!;
    const body = JSON.parse(submitCall[2]!.body as string);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]!.data.models).toEqual(["claude-sonnet-4-5-20250929"]);
    expect(body.entries[0]!.data.costUSD).toBe(0.05);
  });

});

// ---------------------------------------------------------------------------
// login-if-needed (absorbed from syncCommand)
// ---------------------------------------------------------------------------

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("pushCommand — login-if-needed", () => {
  it("runs login when not authenticated, then pushes today", async () => {
    mockLoadConfig
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fakeConfig);
    mockLoginCommand.mockResolvedValue(undefined);

    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    expect(mockLoginCommand).toHaveBeenCalledTimes(1);
  });

  it("exits if login fails to produce config", async () => {
    mockLoadConfig.mockReturnValue(null);
    mockLoginCommand.mockResolvedValue(undefined);

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// smart sync (no --days/--date flags)
// ---------------------------------------------------------------------------

describe("pushCommand — smart sync", () => {
  it("backfills 3 days when no last_push_date", async () => {
    mockLoadConfig.mockReturnValue(fakeConfig);
    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    expect(mockLoginCommand).not.toHaveBeenCalled();
    // First push backfills 3 days: sinceDate = today - 2, untilDate = today
    const [sinceArg, untilArg] = mockRunCcusageRawAsync.mock.calls[0]!;
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    expect(sinceArg).toBe(fmt(threeDaysAgo));
    expect(untilArg).toBe(fmt(today));
  });

  it("re-syncs today when last_push_date is today", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: todayStr() });
    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    const [sinceArg, untilArg] = mockRunCcusageRawAsync.mock.calls[0]!;
    expect(sinceArg).toBe(untilArg);
  });

  it("pushes diff days when last_push_date is in the past", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: daysAgoStr(3) });
    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    const [sinceArg, untilArg] = mockRunCcusageRawAsync.mock.calls[0]!;
    // sinceArg should be earlier than untilArg
    expect(sinceArg).not.toBe(untilArg);
  });

  it("caps days at MAX_BACKFILL_DAYS when gap is large", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: daysAgoStr(30) });
    mockRunCcusageRawAsync.mockResolvedValue("[]");
    mockParseCcusageOutput.mockReturnValue({ data: [] });

    await pushCommand({});

    const [sinceArg] = mockRunCcusageRawAsync.mock.calls[0]!;
    // Since date should be 6 days ago (7 days total including today)
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const expectedSince = `${sixDaysAgo.getFullYear()}${String(sixDaysAgo.getMonth() + 1).padStart(2, "0")}${String(sixDaysAgo.getDate()).padStart(2, "0")}`;
    expect(sinceArg).toBe(expectedSince);
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
