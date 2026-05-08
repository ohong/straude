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

vi.mock("../../src/lib/agentsview.js", () => ({
  AGENTSVIEW_COLLECTOR: "agentsview-v1",
  MIN_AGENTSVIEW_VERSION: "0.28.0",
  getAgentsViewVersion: vi.fn(),
  isSupportedAgentsViewVersion: vi.fn((version: string | null) => version != null && version >= "0.28.0"),
  runAgentsViewRawAsync: vi.fn(),
  parseAgentsViewOutput: vi.fn(),
}));

vi.mock("../../src/lib/spinner.js", () => ({
  Spinner: class {
    start = vi.fn();
    stop = vi.fn();
  },
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

import { pushCommand } from "../../src/commands/push.js";
import { loadConfig, saveConfig, updateLastPushDate } from "../../src/lib/auth.js";
import { loginCommand } from "../../src/commands/login.js";
import { apiRequest } from "../../src/lib/api.js";
import { getAgentsViewVersion, runAgentsViewRawAsync, parseAgentsViewOutput } from "../../src/lib/agentsview.js";
import { posthog } from "../../src/lib/posthog.js";
import { reportUsagePushFailed } from "../../src/lib/telemetry.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockSaveConfig = vi.mocked(saveConfig);
const mockUpdateLastPushDate = vi.mocked(updateLastPushDate);
const mockLoginCommand = vi.mocked(loginCommand);
const mockApiRequest = vi.mocked(apiRequest);
const mockGetAgentsViewVersion = vi.mocked(getAgentsViewVersion);
const mockRunAgentsViewRawAsync = vi.mocked(runAgentsViewRawAsync);
const mockParseAgentsViewOutput = vi.mocked(parseAgentsViewOutput);
const mockPosthogCapture = vi.mocked(posthog.capture);
const mockReportUsagePushFailed = vi.mocked(reportUsagePushFailed);

const fakeConfig = {
  token: "tok",
  username: "alice",
  api_url: "https://straude.com",
  device_id: "device-1",
  device_name: "MacBook",
};

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function usageEntry(date: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    models: ["claude-opus-4-20250505", "gpt-5-codex"],
    inputTokens: 1000,
    outputTokens: 500,
    cacheCreationTokens: 100,
    cacheReadTokens: 50,
    totalTokens: 1650,
    costUSD: 10.0,
    modelBreakdown: [
      { model: "claude-opus-4-20250505", cost_usd: 7.0 },
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ],
    ...overrides,
  };
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mockSubmitResponse(date = todayStr()) {
  mockApiRequest
    .mockResolvedValueOnce({
      results: [
        { date, usage_id: "u-1", post_id: "p-1", post_url: "https://straude.com/post/p-1", action: "created" },
      ],
    })
    .mockRejectedValueOnce(new Error("dashboard not mocked"));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue(fakeConfig);
  mockGetAgentsViewVersion.mockResolvedValue("0.28.0");
  mockRunAgentsViewRawAsync.mockResolvedValue("agentsview-json");
  mockParseAgentsViewOutput.mockReturnValue({
    data: [usageEntry(todayStr())],
    anomalies: [],
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
  it("requires agentsview 0.28.0 or newer", async () => {
    mockGetAgentsViewVersion.mockResolvedValue("0.27.0");

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("agentsview 0.28.0 or newer is required"),
    );
    expect(mockRunAgentsViewRawAsync).not.toHaveBeenCalled();
  });

  it("prints a clear install message when agentsview is missing", async () => {
    mockGetAgentsViewVersion.mockRejectedValue(new Error("agentsview is not installed or not on PATH. Install it from https://www.agentsview.io/."));

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(console.error).toHaveBeenCalledWith(
      "agentsview 0.28.0 or newer is required. Install or upgrade it from https://www.agentsview.io/.",
    );
  });

  it("submits agentsview usage as unified collector data", async () => {
    const today = todayStr();
    mockSubmitResponse(today);

    await pushCommand({});

    expect(mockRunAgentsViewRawAsync).toHaveBeenCalledWith(
      "2026-03-11",
      "2026-03-13",
      undefined,
      { timezone: expect.any(String) },
    );
    const submitCall = mockApiRequest.mock.calls[0]!;
    expect(submitCall[1]).toBe("/api/usage/submit");
    const body = JSON.parse(submitCall[2]!.body as string);
    expect(body.collector).toEqual({ unified: "agentsview-v1" });
    expect(body.entries).toEqual([{ date: today, data: usageEntry(today) }]);
    expect(body.device_id).toBe("device-1");
    expect(mockUpdateLastPushDate).toHaveBeenCalledWith(today);
  });

  it("forwards explicit date ranges and timeout to agentsview", async () => {
    mockSubmitResponse("2026-03-12");
    mockParseAgentsViewOutput.mockReturnValue({
      data: [usageEntry("2026-03-12")],
      anomalies: [],
    });

    await pushCommand({ date: "2026-03-12", timeoutMs: 60_000 });

    expect(mockGetAgentsViewVersion).toHaveBeenCalledWith(3_000);
    expect(mockRunAgentsViewRawAsync).toHaveBeenCalledWith(
      "2026-03-12",
      "2026-03-12",
      60_000,
      { timezone: expect.any(String) },
    );
  });

  it("does not submit when agentsview returns no usage rows", async () => {
    mockParseAgentsViewOutput.mockReturnValue({ data: [], anomalies: [] });

    await pushCommand({});

    expect(console.log).toHaveBeenCalledWith("No usage data found for the specified period.");
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("filters rows outside the server backfill window before submit", async () => {
    const today = todayStr();
    mockParseAgentsViewOutput.mockReturnValue({
      data: [
        usageEntry("2026-01-01"),
        usageEntry(today),
      ],
      anomalies: [],
    });
    mockSubmitResponse(today);

    await pushCommand({ days: 30 });

    const body = JSON.parse(mockApiRequest.mock.calls[0]![2]!.body as string);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].date).toBe(today);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("skipping 1 date(s)"));
  });

  it("dry-run renders local entries without submitting", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("dashboard unavailable"));

    await pushCommand({ dryRun: true });

    expect(mockApiRequest).toHaveBeenCalledWith(fakeConfig, "/api/cli/dashboard");
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("dry run"));
  });

  it("logs in when no config exists", async () => {
    const today = todayStr();
    mockLoadConfig
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fakeConfig);
    mockSubmitResponse(today);

    await pushCommand({}, "https://straude.test");

    expect(mockLoginCommand).toHaveBeenCalledWith("https://straude.test");
    expect(mockApiRequest.mock.calls[0]![0]).toEqual({ ...fakeConfig, api_url: "https://straude.test" });
  });

  it("creates a device id on first push from an older config", async () => {
    mockLoadConfig.mockReturnValue({
      token: "tok",
      username: "alice",
      api_url: "https://straude.com",
    });
    mockSubmitResponse(todayStr());

    await pushCommand({});

    expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
      device_id: expect.any(String),
      device_name: expect.any(String),
    }));
  });

  it("reports submit failures", async () => {
    const err = new Error("server down");
    mockApiRequest.mockRejectedValueOnce(err);

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(mockReportUsagePushFailed).toHaveBeenCalledWith(fakeConfig, err, {
      command: "push",
      stage: "submit",
    });
  });

  it("captures simplified collector telemetry", async () => {
    mockSubmitResponse(todayStr());

    await pushCommand({});

    expect(mockPosthogCapture).toHaveBeenCalledWith(expect.objectContaining({
      event: "usage_pushed",
      properties: expect.objectContaining({
        collector_mode: "agentsview-unified",
        agentsview_version: "0.28.0",
      }),
    }));
  });
});
