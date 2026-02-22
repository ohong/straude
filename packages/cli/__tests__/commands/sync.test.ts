import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/auth.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../../src/commands/login.js", () => ({
  loginCommand: vi.fn(),
}));

vi.mock("../../src/commands/push.js", () => ({
  pushCommand: vi.fn(),
}));

vi.mock("../../src/lib/ccusage.js", () => ({
  runCcusageRaw: vi.fn(),
  parseCcusageOutput: vi.fn(),
}));

vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return { ...actual };
});

import { syncCommand } from "../../src/commands/sync.js";
import { loadConfig } from "../../src/lib/auth.js";
import { loginCommand } from "../../src/commands/login.js";
import { pushCommand } from "../../src/commands/push.js";
import { runCcusageRaw, parseCcusageOutput } from "../../src/lib/ccusage.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockLoginCommand = vi.mocked(loginCommand);
const mockPushCommand = vi.mocked(pushCommand);
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

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncCommand", () => {
  it("runs login when not authenticated, then pushes today", async () => {
    // First call: not logged in. Second call (after login): config exists.
    mockLoadConfig
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fakeConfig);
    mockLoginCommand.mockResolvedValue(undefined);
    mockPushCommand.mockResolvedValue(undefined);

    await syncCommand();

    expect(mockLoginCommand).toHaveBeenCalledTimes(1);
    expect(mockPushCommand).toHaveBeenCalledWith({}, fakeConfig);
  });

  it("pushes today when no last_push_date", async () => {
    mockLoadConfig.mockReturnValue(fakeConfig);
    mockPushCommand.mockResolvedValue(undefined);

    await syncCommand();

    expect(mockLoginCommand).not.toHaveBeenCalled();
    expect(mockPushCommand).toHaveBeenCalledWith({}, fakeConfig);
  });

  it("re-syncs today when last_push_date is today", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: todayStr() });
    mockPushCommand.mockResolvedValue(undefined);

    await syncCommand();

    expect(mockPushCommand).toHaveBeenCalledWith(
      { days: 1 },
      expect.objectContaining({ token: "tok" }),
    );
  });

  it("pushes diff days when last_push_date is in the past", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: daysAgoStr(3) });
    mockPushCommand.mockResolvedValue(undefined);

    await syncCommand();

    expect(mockPushCommand).toHaveBeenCalledWith(
      { days: 3 },
      expect.objectContaining({ token: "tok" }),
    );
  });

  it("caps days at MAX_BACKFILL_DAYS when gap is large", async () => {
    mockLoadConfig.mockReturnValue({ ...fakeConfig, last_push_date: daysAgoStr(30) });
    mockPushCommand.mockResolvedValue(undefined);

    await syncCommand();

    expect(mockPushCommand).toHaveBeenCalledWith(
      { days: 7 },
      expect.objectContaining({ token: "tok" }),
    );
  });

  it("exits if login fails to produce config", async () => {
    mockLoadConfig.mockReturnValue(null);
    mockLoginCommand.mockResolvedValue(undefined);

    await expect(syncCommand()).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
