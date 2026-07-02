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
  CCUSAGE_DEFAULT_PRICING_MODE: "offline",
  collectCcusageUsageAsync: vi.fn(),
}));

vi.mock("../../src/lib/telemetry.js", () => ({
  reportUsagePushFailed: vi.fn(),
  shutdownTelemetryWithTimeout: vi.fn(() => Promise.resolve(0)),
  TELEMETRY_SHUTDOWN_TIMEOUT_MS: 150,
  errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock("../../src/lib/posthog.js", () => ({
  posthog: {
    capture: vi.fn(),
    _shutdown: vi.fn(() => Promise.resolve()),
  },
}));

import { createHash } from "node:crypto";
import { pushCommand } from "../../src/commands/push.js";
import { loadConfig, saveConfig, updateLastPushDate } from "../../src/lib/auth.js";
import { loginCommand } from "../../src/commands/login.js";
import { apiRequest } from "../../src/lib/api.js";
import { collectCcusageUsageAsync } from "../../src/lib/ccusage.js";
import { reportUsagePushFailed, shutdownTelemetryWithTimeout } from "../../src/lib/telemetry.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockSaveConfig = vi.mocked(saveConfig);
const mockUpdateLastPushDate = vi.mocked(updateLastPushDate);
const mockLoginCommand = vi.mocked(loginCommand);
const mockApiRequest = vi.mocked(apiRequest);
const mockCollectCcusageUsageAsync = vi.mocked(collectCcusageUsageAsync);
const mockReportUsagePushFailed = vi.mocked(reportUsagePushFailed);
const mockShutdownTelemetry = vi.mocked(shutdownTelemetryWithTimeout);

const fakeConfig = {
  token: "tok",
  username: "alice",
  api_url: "https://straude.com",
  device_id: "device-1",
  device_name: "work-laptop",
  ccusage_v20_migration_completed_at: "2026-05-01T00:00:00.000Z",
};

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function compact(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function usageEntry(date = todayStr(), overrides: Record<string, unknown> = {}) {
  return {
    date,
    models: ["claude-sonnet-4-5-20250929", "gpt-5.2-codex"],
    inputTokens: 1200,
    outputTokens: 400,
    reasoningOutputTokens: 100,
    cacheCreationTokens: 100,
    cacheReadTokens: 300,
    totalTokens: 2100,
    costUSD: 0.25,
    modelBreakdown: [
      { model: "claude-sonnet-4-5-20250929", cost_usd: 0.2 },
      { model: "gpt-5.2-codex", cost_usd: 0.05 },
    ],
    ...overrides,
  };
}

function ccusageOutput(entries = [usageEntry()], overrides: Record<string, unknown> = {}) {
  return {
    data: entries,
    summary: {
      totalInputTokens: entries.reduce((sum, entry) => sum + entry.inputTokens, 0),
      totalOutputTokens: entries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalReasoningOutputTokens: entries.reduce((sum, entry) => sum + (entry.reasoningOutputTokens ?? 0), 0),
      totalCacheCreationTokens: entries.reduce((sum, entry) => sum + entry.cacheCreationTokens, 0),
      totalCacheReadTokens: entries.reduce((sum, entry) => sum + entry.cacheReadTokens, 0),
      totalTokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
      totalCostUSD: entries.reduce((sum, entry) => sum + entry.costUSD, 0),
    },
    agents: ["claude", "codex"],
    collector: {
      claude: "ccusage-claude-v20",
      codex: "ccusage-codex-v20",
      ccusage_version: "20.0.6",
      ccusage_agents: ["claude", "codex"],
      pricing_mode: "offline",
    },
    version: "20.0.6",
    raw: JSON.stringify({ daily: entries }),
    stderr: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue({ ...fakeConfig });
  mockCollectCcusageUsageAsync.mockResolvedValue(ccusageOutput() as never);
  mockApiRequest.mockImplementation(async (_config, path) => {
    if (path === "/api/cli/dashboard") {
      throw new Error("dashboard not mocked");
    }
    return {
      results: [
        {
          date: todayStr(),
          usage_id: "u-1",
          post_id: "p-1",
          post_url: "https://straude.com/post/p-1",
          action: "created",
        },
      ],
    };
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
  it("submits unified ccusage rows with v20 collector metadata", async () => {
    await pushCommand({});

    expect(mockCollectCcusageUsageAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      undefined,
      { pricingMode: "offline" },
    );
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.objectContaining(fakeConfig),
      "/api/usage/submit",
      expect.objectContaining({ method: "POST" }),
    );

    const submitCall = mockApiRequest.mock.calls.find(([, path]) => path === "/api/usage/submit")!;
    const body = JSON.parse((submitCall[2] as { body: string }).body);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].data.reasoningOutputTokens).toBe(100);
    expect(body.collector).toEqual({
      claude: "ccusage-claude-v20",
      codex: "ccusage-codex-v20",
      ccusage_version: "20.0.6",
      ccusage_agents: ["claude", "codex"],
      pricing_mode: "offline",
    });
    expect(body.device_id).toBe("device-1");
    expect(body.device_name).toBe("work-laptop");
  });

  it("hashes the ccusage v20 raw payload and collector run metadata", async () => {
    const output = ccusageOutput([usageEntry()], {
      raw: '{"daily":[{"period":"2026-03-13"}]}',
    });
    mockCollectCcusageUsageAsync.mockResolvedValue(output as never);

    await pushCommand({});

    const submitCall = mockApiRequest.mock.calls.find(([, path]) => path === "/api/usage/submit")!;
    const body = JSON.parse((submitCall[2] as { body: string }).body);
    const [since, until] = mockCollectCcusageUsageAsync.mock.calls[0]!;
    const concreteHash = createHash("sha256").update(JSON.stringify({
      collector: "ccusage-v20",
      version: output.version,
      agents: output.agents,
      since,
      until,
      raw: output.raw,
    })).digest("hex");
    expect(body.hash).toBe(concreteHash);
  });

  it("respects explicit --days even when the migration backfill marker is missing", async () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    mockLoadConfig.mockReturnValue({
      ...fakeConfig,
      ccusage_v20_migration_completed_at: undefined,
      last_push_date: daysAgoStr(2),
    });

    await pushCommand({ days: 3 });

    expect(mockCollectCcusageUsageAsync).toHaveBeenCalledWith(
      compact(twoDaysAgo),
      compact(today),
      undefined,
      { pricingMode: "offline" },
    );
    expect(mockUpdateLastPushDate).toHaveBeenCalledWith(todayStr());
    expect(mockSaveConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      ccusage_v20_migration_completed_at: expect.any(String),
    }));
  });

  it("marks the ccusage v20 migration complete after an explicit 30-day backfill", async () => {
    const today = new Date();
    const twentyNineDaysAgo = new Date(today);
    twentyNineDaysAgo.setDate(today.getDate() - 29);
    mockLoadConfig.mockReturnValue({
      ...fakeConfig,
      ccusage_v20_migration_completed_at: undefined,
      last_push_date: daysAgoStr(2),
    });

    await pushCommand({ days: 30 });

    expect(mockCollectCcusageUsageAsync).toHaveBeenCalledWith(
      compact(twentyNineDaysAgo),
      compact(today),
      undefined,
      { pricingMode: "offline" },
    );
    expect(mockSaveConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      ccusage_v20_migration_completed_at: expect.any(String),
      last_push_date: todayStr(),
    }));
    expect(mockSaveConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      codex_native_repair_completed_at: expect.any(String),
    }));
  });

  it("uses exact --date without running migration backfill", async () => {
    mockLoadConfig.mockReturnValue({
      ...fakeConfig,
      ccusage_v20_migration_completed_at: undefined,
    });

    await pushCommand({ date: "2026-03-12" });

    expect(mockCollectCcusageUsageAsync).toHaveBeenCalledWith("20260312", "20260312", undefined, {
      pricingMode: "offline",
    });
    expect(mockUpdateLastPushDate).toHaveBeenCalledWith(todayStr());
    expect(mockSaveConfig).not.toHaveBeenCalledWith(expect.objectContaining({
      ccusage_v20_migration_completed_at: expect.any(String),
    }));
  });

  it("forwards --timeout to ccusage", async () => {
    await pushCommand({ timeoutMs: 300_000 });
    expect(mockCollectCcusageUsageAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      300_000,
      { pricingMode: "offline" },
    );
  });

  it("filters out-of-window ccusage rows before submit", async () => {
    const oldDate = "2026-01-12";
    mockCollectCcusageUsageAsync.mockResolvedValue(ccusageOutput([
      usageEntry(oldDate),
      usageEntry(todayStr()),
    ]) as never);

    await pushCommand({ days: 30 });

    const submitCall = mockApiRequest.mock.calls.find(([, path]) => path === "/api/usage/submit")!;
    const body = JSON.parse((submitCall[2] as { body: string }).body);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].date).toBe(todayStr());
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`skipping 1 date(s) outside the 30-day backfill window: ${oldDate}`),
    );
  });

  it("dry-run fetches dashboard but skips submit", async () => {
    await pushCommand({ dryRun: true });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.objectContaining(fakeConfig),
      "/api/cli/dashboard",
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("dry run"));
  });

  it("reports scan failures and exits before submit", async () => {
    const error = new Error("ccusage 20.0.4 is unsupported");
    mockCollectCcusageUsageAsync.mockRejectedValue(error);

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(mockReportUsagePushFailed).toHaveBeenCalledWith(
      expect.objectContaining(fakeConfig),
      error,
      expect.objectContaining({
        command: "push",
        stage: "scan",
        pricing_mode: "offline",
        collection_ms: expect.any(Number),
        total_ms: expect.any(Number),
      }),
    );
    expect(mockShutdownTelemetry).toHaveBeenCalled();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("reports submit failures and exits", async () => {
    const error = new Error("Server error");
    mockApiRequest.mockRejectedValue(error);

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(mockReportUsagePushFailed).toHaveBeenCalledWith(
      expect.objectContaining(fakeConfig),
      error,
      expect.objectContaining({
        command: "push",
        stage: "submit",
        pricing_mode: "offline",
        collection_ms: expect.any(Number),
        submit_ms: expect.any(Number),
        total_ms: expect.any(Number),
      }),
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("logs in when config is missing", async () => {
    mockLoadConfig
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ ...fakeConfig });

    await pushCommand({});

    expect(mockLoginCommand).toHaveBeenCalledTimes(1);
  });

  it("generates and persists a device id on first push", async () => {
    mockLoadConfig.mockReturnValue({
      token: "tok",
      username: "alice",
      api_url: "https://straude.com",
      ccusage_v20_migration_completed_at: "2026-05-01T00:00:00.000Z",
    });

    await pushCommand({});

    const savedConfig = mockSaveConfig.mock.calls[0]![0];
    expect(savedConfig.device_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(savedConfig.device_name).toBeDefined();
    const submitCall = mockApiRequest.mock.calls.find(([, path]) => path === "/api/usage/submit")!;
    const body = JSON.parse((submitCall[2] as { body: string }).body);
    expect(body.device_id).toBe(savedConfig.device_id);
  });

  it("returns without submit when ccusage has no rows", async () => {
    mockCollectCcusageUsageAsync.mockResolvedValue(ccusageOutput([], {
      agents: [],
      collector: {
        ccusage_version: "20.0.6",
        ccusage_agents: [],
        pricing_mode: "offline",
      },
      raw: '{"daily":[]}',
    }) as never);

    await pushCommand({});

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No usage data found"),
    );
  });
});
