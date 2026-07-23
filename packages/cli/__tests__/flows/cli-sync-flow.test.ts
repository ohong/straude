import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  execFileSync: vi.fn(),
  execFile: execFileMock,
}));

vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return { ...actual, POLL_INTERVAL_MS: 1 };
});

let configStore: Record<string, string> = {};
let nextFd = 10;
const fdPaths = new Map<number, string>();

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path in configStore),
  readFileSync: vi.fn((path: string) => configStore[path] ?? ""),
  writeFileSync: vi.fn((pathOrFd: string | number, data: string) => {
    const path = typeof pathOrFd === "number" ? fdPaths.get(pathOrFd)! : pathOrFd;
    configStore[path] = data;
  }),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ mode: 0o755, mtimeMs: Date.now() })),
  chmodSync: vi.fn(),
  openSync: vi.fn((path: string) => {
    const fd = nextFd++;
    fdPaths.set(fd, path);
    return fd;
  }),
  closeSync: vi.fn(),
  fsyncSync: vi.fn(),
  renameSync: vi.fn((from: string, to: string) => {
    configStore[to] = configStore[from]!;
    delete configStore[from];
  }),
  unlinkSync: vi.fn((path: string) => {
    delete configStore[path];
  }),
}));

import { pushCommand } from "../../src/commands/push.js";
import { CONFIG_FILE } from "../../src/config.js";
import { _resetCcusageResolver, _setCcusageCommandForTests } from "../../src/lib/ccusage.js";

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

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    token: "tok-123",
    username: "alice",
    api_url: "https://straude.com",
    device_id: "22222222-2222-4222-8222-222222222222",
    device_name: "work-laptop",
    ccusage_v20_migration_completed_at: "2026-05-01T00:00:00.000Z",
    usage_protocol_v2_migration_completed_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function seedConfig(overrides: Record<string, unknown> = {}) {
  configStore[CONFIG_FILE] = JSON.stringify(makeConfig(overrides), null, 2) + "\n";
}

function readPersistedConfig(): Record<string, unknown> {
  return JSON.parse(configStore[CONFIG_FILE] ?? "{}");
}

function ccusageJson(date = todayStr()) {
  return JSON.stringify({
    daily: [
      {
        period: date,
        modelsUsed: ["claude-sonnet-4-5-20250929", "gpt-5.2-codex"],
        inputTokens: 1200,
        outputTokens: 400,
        cacheCreationTokens: 100,
        cacheReadTokens: 300,
        totalTokens: 2000,
        totalCost: 0.25,
        modelBreakdowns: [
          { modelName: "claude-sonnet-4-5-20250929", cost: 0.2 },
          { modelName: "gpt-5.2-codex", cost: 0.05 },
        ],
        metadata: { agents: ["claude", "codex"] },
        agents: [
          {
            agent: "claude",
            modelsUsed: ["claude-sonnet-4-5-20250929"],
            inputTokens: 600,
            outputTokens: 200,
            cacheCreationTokens: 100,
            cacheReadTokens: 100,
            totalTokens: 1000,
            totalCost: 0.2,
            modelBreakdowns: [{
              modelName: "claude-sonnet-4-5-20250929",
              inputTokens: 600,
              outputTokens: 200,
              cacheCreationTokens: 100,
              cacheReadTokens: 100,
              totalTokens: 1000,
              cost: 0.2,
            }],
          },
          {
            agent: "codex",
            modelsUsed: ["gpt-5.2-codex"],
            inputTokens: 600,
            outputTokens: 200,
            cacheCreationTokens: 0,
            cacheReadTokens: 200,
            totalTokens: 1000,
            totalCost: 0.05,
            modelBreakdowns: [{
              modelName: "gpt-5.2-codex",
              inputTokens: 600,
              outputTokens: 200,
              cacheCreationTokens: 0,
              cacheReadTokens: 200,
              totalTokens: 1000,
              cost: 0.05,
            }],
          },
        ],
      },
    ],
  });
}

const TEST_CCUSAGE_VERSION = "20.0.18";

function mockCcusage(json = ccusageJson()) {
  execFileMock.mockImplementation((_cmd: string, _args: string[], _options: unknown, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    callback(null, json, "");
  });
}

function mockSuccessfulSubmit(date = todayStr()) {
  mockFetch.mockImplementationOnce(async (_url, options) => {
    const request = JSON.parse(options.body);
    return {
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          request_id: request.request_id,
          outcomes: [{
            date,
            status: "committed",
            result: {
              usage_id: "u-1",
              post_id: "p-1",
              post_url: "https://straude.com/post/p-1",
              action: "created",
            },
          }],
        }),
    };
  });
  mockFetch.mockRejectedValueOnce(new Error("dashboard not mocked"));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T12:00:00Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  _resetCcusageResolver();
  _setCcusageCommandForTests({ cmd: "/bundled/ccusage", args: [], version: TEST_CCUSAGE_VERSION });
  configStore = {};
  nextFd = 10;
  fdPaths.clear();
  mockCcusage();
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

describe("unified ccusage CLI flow", () => {
  it("submits v20 unified Claude+Codex usage through the API", async () => {
    seedConfig();
    mockSuccessfulSubmit();

    await pushCommand({});

    expect(execFileMock).toHaveBeenCalledWith(
      "/bundled/ccusage",
      expect.arrayContaining(["daily", "--json", "--no-offline"]),
      expect.any(Object),
      expect.any(Function),
    );

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);
    expect(body.protocol_version).toBe(2);
    expect(body.entries[0].agents).toHaveLength(2);
    expect(body.entries[0].agents[0]).toEqual(expect.objectContaining({
      reasoning_output_tokens: 0,
      total_tokens: 1000,
    }));
    expect(body.collector).toEqual(expect.objectContaining({
      name: "ccusage",
      version: TEST_CCUSAGE_VERSION,
      pricing_mode: "online",
    }));
    expect(readPersistedConfig().last_push_date).toBe(todayStr());
  });

  it("respects explicit --days before the migration backfill has completed", async () => {
    seedConfig({
      ccusage_v20_migration_completed_at: undefined,
      usage_protocol_v2_migration_completed_at: undefined,
      last_push_date: "2026-03-01",
    });
    mockSuccessfulSubmit();

    await pushCommand({ days: 3 });

    const dailyCall = execFileMock.mock.calls.find(([, args]) =>
      Array.isArray(args) && args.includes("daily"),
    )!;
    const args = dailyCall[1] as string[];
    const since = args[args.indexOf("--since") + 1];
    expect(since).toBe("20260311");
    expect(readPersistedConfig().ccusage_v20_migration_completed_at).toBeUndefined();
  });

  it("does not mark the automatic migration complete after explicit 30-day backfill", async () => {
    seedConfig({
      ccusage_v20_migration_completed_at: undefined,
      usage_protocol_v2_migration_completed_at: undefined,
      last_push_date: "2026-03-01",
    });
    mockSuccessfulSubmit();

    await pushCommand({ days: 30 });

    const dailyCall = execFileMock.mock.calls.find(([, args]) =>
      Array.isArray(args) && args.includes("daily"),
    )!;
    const args = dailyCall[1] as string[];
    const since = args[args.indexOf("--since") + 1];
    expect(since).toBe("20260212");
    expect(readPersistedConfig().usage_protocol_v2_migration_completed_at).toBeUndefined();
  });

  it("submits usage from ccusage sources beyond Claude and Codex", async () => {
    seedConfig();
    mockSuccessfulSubmit();
    mockCcusage(JSON.stringify({
      daily: [
        {
          period: todayStr(),
          modelsUsed: ["gemini-pro"],
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 2,
          totalCost: 0.01,
          modelBreakdowns: [{
            modelName: "gemini-pro",
            inputTokens: 1,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 2,
            cost: 0.01,
          }],
          metadata: { agents: ["gemini"] },
          agents: [{
            agent: "gemini",
            modelsUsed: ["gemini-pro"],
            inputTokens: 1,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 2,
            totalCost: 0.01,
            modelBreakdowns: [{
              modelName: "gemini-pro",
              inputTokens: 1,
              outputTokens: 1,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              totalTokens: 2,
              cost: 0.01,
            }],
          }],
        },
      ],
    }));

    await pushCommand({});

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);
    expect(body.entries[0].agents[0]).toMatchObject({
      agent: "gemini",
      models: ["gemini-pro"],
      total_tokens: 2,
      cost_usd: 0.01,
    });
    expect(body.collector).toEqual(expect.objectContaining({
      version: TEST_CCUSAGE_VERSION,
      pricing_mode: "online",
    }));
    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
