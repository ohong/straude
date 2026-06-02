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
  CCUSAGE_CLAUDE_COLLECTOR: "ccusage-claude-v20",
  CCUSAGE_CODEX_COLLECTOR: "ccusage-codex-v20",
  runCcusageAgentRawAsync: vi.fn(),
  parseCcusageOutput: vi.fn(),
  ensureCcusageInstalled: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/lib/codex-native.js", () => ({
  containsSessionFile: vi.fn(),
}));

vi.mock("../../src/lib/posthog.js", () => ({
  posthog: {
    capture: vi.fn(),
    _shutdown: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../../src/lib/telemetry.js", () => ({
  reportUsagePushFailed: vi.fn(),
  errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock("../../src/commands/push-output.js", () => ({
  printDryRunEntries: vi.fn(),
  printSubmittedResults: vi.fn(),
  renderPushSummary: vi.fn(() => Promise.resolve()),
}));

import { pushCommand, mergeEntries } from "../../src/commands/push.js";
import { loadConfig, saveConfig, updateLastPushDate } from "../../src/lib/auth.js";
import { loginCommand } from "../../src/commands/login.js";
import { apiRequest } from "../../src/lib/api.js";
import { runCcusageAgentRawAsync, parseCcusageOutput } from "../../src/lib/ccusage.js";
import { containsSessionFile } from "../../src/lib/codex-native.js";
import { reportUsagePushFailed } from "../../src/lib/telemetry.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockSaveConfig = vi.mocked(saveConfig);
const mockUpdateLastPushDate = vi.mocked(updateLastPushDate);
const mockLoginCommand = vi.mocked(loginCommand);
const mockApiRequest = vi.mocked(apiRequest);
const mockRunCcusageAgentRawAsync = vi.mocked(runCcusageAgentRawAsync);
const mockParseCcusageOutput = vi.mocked(parseCcusageOutput);
const mockHasCodexLogs = vi.mocked(containsSessionFile);
const mockReportUsagePushFailed = vi.mocked(reportUsagePushFailed);

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

function usageEntry(date: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    models: ["claude-sonnet-4-5-20250929"],
    inputTokens: 1000,
    outputTokens: 500,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 1500,
    costUSD: 0.05,
    ...overrides,
  };
}

function mockSourceData(args: {
  claude?: ReturnType<typeof usageEntry>[];
  codex?: ReturnType<typeof usageEntry>[];
} = {}) {
  const claude = args.claude ?? [];
  const codex = args.codex ?? [];

  mockRunCcusageAgentRawAsync.mockImplementation(async (agent) => `${agent}-raw`);
  mockParseCcusageOutput.mockImplementation((_raw, agent) => ({
    data: agent === "codex" ? codex : claude,
    rowMetadata: (agent === "codex" ? codex : claude).map((entry) => ({
      date: entry.date,
      agents: [agent],
    })),
    anomalies: [],
  }));
}

function submitCallBody() {
  const submitCall = mockApiRequest.mock.calls.find(([, path]) => path === "/api/usage/submit");
  expect(submitCall).toBeDefined();
  return JSON.parse((submitCall![2] as { body: string }).body);
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue(fakeConfig);
  mockHasCodexLogs.mockResolvedValue(false);
  mockSourceData();
  mockApiRequest.mockImplementation(async (_config, path) => {
    if (path === "/api/usage/submit") {
      return {
        results: [
          { date: todayStr(), usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
        ],
      };
    }
    return { days: [] };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("pushCommand", () => {
  it("submits source-focused Claude usage with v20 collector metadata", async () => {
    const today = todayStr();
    mockSourceData({ claude: [usageEntry(today)] });

    await pushCommand({});

    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "claude",
      expect.any(String),
      expect.any(String),
      undefined,
    );
    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "codex",
      expect.any(String),
      expect.any(String),
      undefined,
    );

    const body = submitCallBody();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].data.costUSD).toBe(0.05);
    expect(body.collector).toEqual({ claude: "ccusage-claude-v20" });
    expect(body.source).toBe("cli");
  });

  it("merges Claude and Codex data for the same day", async () => {
    const today = todayStr();
    mockSourceData({
      claude: [
        usageEntry(today, {
          models: ["claude-opus-4-20250505"],
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 100,
          cacheReadTokens: 50,
          totalTokens: 1650,
          costUSD: 10,
          modelBreakdown: [{ model: "claude-opus-4-20250505", cost_usd: 10 }],
        }),
      ],
      codex: [
        usageEntry(today, {
          models: ["gpt-5-codex"],
          inputTokens: 2000,
          outputTokens: 800,
          totalTokens: 2800,
          costUSD: 3,
          modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 3 }],
        }),
      ],
    });

    await pushCommand({});

    const body = submitCallBody();
    const entry = body.entries[0].data;
    expect(entry.costUSD).toBe(13);
    expect(entry.totalTokens).toBe(4450);
    expect(entry.models).toEqual(["claude-opus-4-20250505", "gpt-5-codex"]);
    expect(entry.modelBreakdown).toEqual([
      { model: "claude-opus-4-20250505", cost_usd: 10 },
      { model: "gpt-5-codex", cost_usd: 3 },
    ]);
    expect(body.collector).toEqual({
      claude: "ccusage-claude-v20",
      codex: "ccusage-codex-v20",
    });
  });

  it("continues with Codex usage when Claude source data is missing", async () => {
    const today = todayStr();
    mockRunCcusageAgentRawAsync.mockImplementation(async (agent) => {
      if (agent === "claude") {
        throw new Error("ccusage failed: No valid Claude data directories found");
      }
      return "codex-raw";
    });
    mockParseCcusageOutput.mockImplementation((_raw, agent) => ({
      data: agent === "codex" ? [
        usageEntry(today, { models: ["gpt-5-codex"], costUSD: 3 }),
      ] : [],
      rowMetadata: [],
      anomalies: [],
    }));

    await pushCommand({});

    const body = submitCallBody();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].data.models).toEqual(["gpt-5-codex"]);
    expect(body.collector).toEqual({ codex: "ccusage-codex-v20" });
  });

  it("fails on generic source errors even if the other source has data", async () => {
    mockRunCcusageAgentRawAsync.mockImplementation(async (agent) => {
      if (agent === "claude") throw new Error("ccusage failed: unexpected runtime error");
      return "codex-raw";
    });
    mockParseCcusageOutput.mockReturnValue({
      data: [usageEntry(todayStr(), { models: ["gpt-5-codex"], costUSD: 3 })],
      rowMetadata: [],
      anomalies: [],
    });

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("forwards date ranges and timeout to both source scans", async () => {
    await pushCommand({ date: "2026-03-12", timeoutMs: 300_000 });

    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "claude",
      "20260312",
      "20260312",
      300_000,
    );
    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "codex",
      "20260312",
      "20260312",
      300_000,
    );
  });

  it("runs one-time 30-day Codex repair range and persists repair markers", async () => {
    const today = todayStr();
    mockHasCodexLogs.mockResolvedValue(true);
    mockLoadConfig.mockReturnValue({
      ...fakeConfig,
      device_id: "device-1",
      device_name: "work-laptop",
    });
    mockSourceData({ codex: [usageEntry(today, { models: ["gpt-5-codex"], costUSD: 3 })] });

    await pushCommand({ days: 3 });

    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "claude",
      "20260212",
      "20260313",
      undefined,
    );
    expect(mockRunCcusageAgentRawAsync).toHaveBeenCalledWith(
      "codex",
      "20260212",
      "20260313",
      undefined,
    );
    expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
      codex_native_repair_completed_at: expect.any(String),
      codex_native_last_token_usage_repair_completed_at: expect.any(String),
      last_push_date: today,
    }));
  });

  it("generates device_id on first push and includes it in submit body", async () => {
    const today = todayStr();
    mockLoadConfig.mockReturnValue({ token: "tok", username: "alice", api_url: "https://straude.com" });
    mockSourceData({ claude: [usageEntry(today)] });

    await pushCommand({});

    expect(mockSaveConfig).toHaveBeenCalled();
    const savedConfig = mockSaveConfig.mock.calls[0]![0];
    const body = submitCallBody();
    expect(savedConfig.device_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.device_id).toBe(savedConfig.device_id);
    expect(body.device_name).toBe(savedConfig.device_name);
  });

  it("updates last push date after a successful normal push", async () => {
    const today = todayStr();
    mockLoadConfig.mockReturnValue({
      ...fakeConfig,
      device_id: "device-1",
      device_name: "work-laptop",
      codex_native_repair_completed_at: "2026-03-01T00:00:00.000Z",
      codex_native_last_token_usage_repair_completed_at: "2026-03-01T00:00:00.000Z",
    });
    mockSourceData({ claude: [usageEntry(today)] });

    await pushCommand({});

    expect(mockUpdateLastPushDate).toHaveBeenCalledWith(today);
  });

  it("reports API submission failures", async () => {
    mockSourceData({ claude: [usageEntry(todayStr())] });
    mockApiRequest.mockRejectedValue(new Error("Server error"));

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(mockReportUsagePushFailed).toHaveBeenCalledWith(
      fakeConfig,
      expect.any(Error),
      { command: "push", stage: "submit" },
    );
  });

  it("runs login when not authenticated", async () => {
    mockLoadConfig
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fakeConfig);
    mockLoginCommand.mockResolvedValue(undefined);

    await pushCommand({});

    expect(mockLoginCommand).toHaveBeenCalledTimes(1);
  });
});

describe("mergeEntries", () => {
  it("keeps separate days sorted by date", () => {
    const merged = mergeEntries(
      [usageEntry("2026-03-13")],
      [usageEntry("2026-03-12", { models: ["gpt-5-codex"], costUSD: 1 })],
    );

    expect(merged.map((entry) => entry.date)).toEqual(["2026-03-12", "2026-03-13"]);
  });

  it("distributes cost across models when no source breakdown is available", () => {
    const merged = mergeEntries(
      [usageEntry("2026-03-13", { models: ["a", "b"], costUSD: 4 })],
      [],
    );

    expect(merged[0]!.modelBreakdown).toEqual([
      { model: "a", cost_usd: 2 },
      { model: "b", cost_usd: 2 },
    ]);
  });
});
