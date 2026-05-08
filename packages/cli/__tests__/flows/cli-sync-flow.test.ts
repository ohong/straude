/**
 * CLI flow tests for the agentsview-backed push path.
 *
 * These keep the broad login/config/fetch/subprocess wiring covered without
 * preserving the old ccusage + native Codex selector machinery.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

let agentsviewRaw = "";

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  execFile: vi.fn((cmd: string, args: string[], _options: unknown, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    if (cmd !== "agentsview") {
      callback(new Error(`unexpected command: ${cmd}`), "", "");
      return {};
    }
    if (args[0] === "version") {
      callback(null, "agentsview v0.28.0\n", "");
      return {};
    }
    if (args[0] === "usage" && args[1] === "daily") {
      callback(null, agentsviewRaw, "");
      return {};
    }
    callback(new Error(`unexpected agentsview args: ${args.join(" ")}`), "", "");
    return {};
  }),
}));

let configStore: Record<string, string> = {};

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) =>
    path in configStore
    || /(^|[\\/])agentsview(\.cmd|\.exe)?$/.test(path),
  ),
  readFileSync: vi.fn((path: string) => configStore[path] ?? ""),
  writeFileSync: vi.fn((path: string, data: string) => {
    configStore[path] = data;
  }),
  mkdirSync: vi.fn(),
}));

vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return { ...actual, POLL_INTERVAL_MS: 1 };
});

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { pushCommand } from "../../src/commands/push.js";
import { CONFIG_FILE } from "../../src/config.js";
import { _resetAgentsViewResolver } from "../../src/lib/agentsview.js";

const mockExecFile = vi.mocked(execFile);
const mockExistsSync = vi.mocked(existsSync);

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    token: "tok-123",
    username: "alice",
    api_url: "https://straude.com",
    device_id: "device-1",
    device_name: "MacBook",
    ...overrides,
  };
}

function seedConfig(overrides: Record<string, unknown> = {}) {
  configStore[CONFIG_FILE] = JSON.stringify(makeConfig(overrides), null, 2) + "\n";
}

function readPersistedConfig(): Record<string, unknown> {
  return JSON.parse(configStore[CONFIG_FILE] ?? "{}");
}

function agentsviewJson(dates: string[]) {
  return JSON.stringify({
    daily: dates.map((date) => ({
      date,
      modelsUsed: ["claude-sonnet-4-6", "gpt-5-codex"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1500,
      totalCost: 0.05,
      modelBreakdowns: [
        { modelName: "claude-sonnet-4-6", cost: 0.03 },
        { modelName: "gpt-5-codex", cost: 0.02 },
      ],
    })),
    totals: {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1500,
      totalCost: 0.05,
    },
  });
}

function mockSuccessfulSubmit(dates: string[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        results: dates.map((date, i) => ({
          date,
          usage_id: `u-${i}`,
          post_id: `p-${i}`,
          post_url: `https://straude.com/post/p-${i}`,
          action: "created",
        })),
      }),
  });
  mockFetch.mockRejectedValueOnce(new Error("dashboard not mocked"));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  _resetAgentsViewResolver();
  configStore = {};
  agentsviewRaw = agentsviewJson([todayStr()]);
  mockExistsSync.mockImplementation((path: string) =>
    path in configStore
    || /(^|[\\/])agentsview(\.cmd|\.exe)?$/.test(path),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("agentsview sync flow", () => {
  it("first-time user: login, save config, push usage", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            code: "ABCD-EFGH",
            verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "completed",
            token: "tok-new",
            username: "alice",
          }),
      });
    mockSuccessfulSubmit([todayStr()]);

    await pushCommand({}, "https://straude.com");

    expect(mockFetch).toHaveBeenCalledTimes(4);
    const saved = readPersistedConfig();
    expect(saved.token).toBe("tok-new");
    expect(saved.last_push_date).toBe(todayStr());
  });

  it("returning user with no last_push_date backfills 3 days through agentsview", async () => {
    seedConfig();
    mockSuccessfulSubmit([todayStr()]);

    await pushCommand({});

    const usageCall = mockExecFile.mock.calls.find((call) => call[1]?.[0] === "usage")!;
    const args = usageCall[1] as string[];
    expect(args).toContain("--breakdown");
    expect(args).toContain("--offline");
    expect(args).not.toContain("--agent");
    expect(args[args.indexOf("--since") + 1]).toBe("2026-03-11");
    expect(args[args.indexOf("--until") + 1]).toBe("2026-03-13");
  });

  it("caps smart sync at DEFAULT_SYNC_DAYS for stale last_push_date", async () => {
    seedConfig({ last_push_date: daysAgoStr(30) });
    mockSuccessfulSubmit([todayStr()]);

    await pushCommand({});

    const usageCall = mockExecFile.mock.calls.find((call) => call[1]?.[0] === "usage")!;
    const args = usageCall[1] as string[];
    expect(args[args.indexOf("--since") + 1]).toBe(daysAgoStr(6));
  });

  it("submits unified collector metadata to /api/usage/submit", async () => {
    seedConfig();
    mockSuccessfulSubmit([todayStr()]);

    await pushCommand({});

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://straude.com/api/usage/submit");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(options.body);
    expect(body.collector).toEqual({ unified: "agentsview-v1" });
    expect(body.entries[0].data.models).toEqual(["claude-sonnet-4-6", "gpt-5-codex"]);
  });

  it("dry-run fetches the dashboard but skips submit and last_push_date persistence", async () => {
    seedConfig({ last_push_date: "2026-03-10" });
    mockFetch.mockRejectedValueOnce(new Error("dashboard unavailable"));

    await pushCommand({ dryRun: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]![0])).toContain("/api/cli/dashboard");
    expect(readPersistedConfig().last_push_date).toBe("2026-03-10");
  });

  it("surfaces API errors after agentsview succeeds", async () => {
    seedConfig();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Internal server error"),
    );
  });

  it("fails clearly when agentsview is missing", async () => {
    seedConfig();
    mockExistsSync.mockImplementation((path: string) => path in configStore);

    await expect(pushCommand({})).rejects.toThrow(ExitError);

    expect(console.error).toHaveBeenCalledWith(
      "agentsview 0.28.0 or newer is required. Install or upgrade it from https://www.agentsview.io/.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uses apiUrlOverride for submit", async () => {
    seedConfig({ api_url: "https://stored.example" });
    mockSuccessfulSubmit([todayStr()]);

    await pushCommand({}, "https://override.example");

    expect(String(mockFetch.mock.calls[0]![0])).toBe("https://override.example/api/usage/submit");
  });
});
