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

import { pushCommand } from "../../src/commands/push.js";
import { requireAuth } from "../../src/lib/auth.js";
import { apiRequest } from "../../src/lib/api.js";
import { runCcusageRaw, parseCcusageOutput } from "../../src/lib/ccusage.js";

const mockRequireAuth = vi.mocked(requireAuth);
const mockApiRequest = vi.mocked(apiRequest);
const mockRunCcusageRaw = vi.mocked(runCcusageRaw);
const mockParseCcusageOutput = vi.mocked(parseCcusageOutput);

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
});
