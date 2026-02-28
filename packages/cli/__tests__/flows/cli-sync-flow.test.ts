/**
 * CLI flow integration tests.
 *
 * These test the full sync/push paths end-to-end, mocking only at boundaries:
 *   - `fetch` (global) — API responses
 *   - `node:child_process` — ccusage binary
 *   - `node:fs` — config persistence
 *
 * This catches issues like wrong API paths (404), expired tokens (401),
 * missing config fields, and broken flow sequencing that unit tests miss.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Boundary mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  execFileSync: vi.fn(),
}));

// Speed up login polling in tests
vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return { ...actual, POLL_INTERVAL_MS: 1 };
});

// In-memory config store
let configStore: Record<string, string> = {};

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path in configStore),
  readFileSync: vi.fn((path: string) => configStore[path] ?? ""),
  writeFileSync: vi.fn((path: string, data: string) => {
    configStore[path] = data;
  }),
  mkdirSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { syncCommand } from "../../src/commands/sync.js";
import { pushCommand } from "../../src/commands/push.js";
import { CONFIG_FILE } from "../../src/config.js";
import { _resetCcusageResolver } from "../../src/lib/ccusage.js";

const mockExecFileSync = vi.mocked(execFileSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    ...overrides,
  };
}

function seedConfig(overrides: Record<string, unknown> = {}) {
  configStore[CONFIG_FILE] = JSON.stringify(makeConfig(overrides), null, 2) + "\n";
}

function readPersistedConfig(): Record<string, unknown> {
  return JSON.parse(configStore[CONFIG_FILE] ?? "{}");
}

/** Builds the JSON that ccusage would emit for a single day. */
function ccusageJson(dates: string[]) {
  return JSON.stringify({
    daily: dates.map((date) => ({
      date,
      modelsUsed: ["claude-sonnet-4-6"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1500,
      totalCost: 0.05,
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

/**
 * Wraps mockExecFileSync to return ccusage JSON for ccusage calls and throw
 * for @ccusage/codex calls (simulating codex not installed — the default).
 */
function mockCcusageOnly(json: string) {
  mockExecFileSync.mockImplementation(((cmd: string, args: string[]) => {
    // @ccusage/codex calls should fail silently
    if (args?.some?.((a: string) => typeof a === "string" && a.includes("@ccusage/codex"))) {
      throw new Error("@ccusage/codex not found");
    }
    return json;
  }) as typeof execFileSync);
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
        })),
      }),
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _resetCcusageResolver();
  configStore = {};
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. SYNC FLOW — Happy paths
// ===========================================================================

describe("sync flow", () => {
  it("first-time user: login → push today", async () => {
    // No config → triggers login
    // Mock login init + poll (two fetch calls)
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

    // After login, loadConfig is called again — config now exists
    // The login flow writes config via saveConfig, which uses our fs mock
    // Then push runs ccusage + submit
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand("https://straude.com");

    // Login was called (init + poll = 2 fetches), then push (submit = 1 fetch)
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Config was saved with token
    const saved = readPersistedConfig();
    expect(saved.token).toBe("tok-new");
    expect(saved.last_push_date).toBe(today);
  });

  it("returning user with no last_push_date: push today only", async () => {
    seedConfig(); // has token, no last_push_date
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBe(today);
  });

  it("returning user already synced today: re-syncs with days=1", async () => {
    seedConfig({ last_push_date: todayStr() });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand();

    // Re-syncs today's data (1 API call)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // 3 execFileSync calls: ccusage --version probe + actual ccusage daily + codex attempt (fails silently)
    expect(mockExecFileSync).toHaveBeenCalledTimes(3);
    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBe(today);
  });

  it("returning user with stale last_push_date: pushes diff days", async () => {
    const threeDaysAgo = daysAgoStr(3);
    seedConfig({ last_push_date: threeDaysAgo });

    const dates = [daysAgoStr(2), daysAgoStr(1), todayStr()];
    mockCcusageOnly(ccusageJson(dates));
    mockSuccessfulSubmit(dates);

    await syncCommand();

    // 3 execFileSync calls: ccusage --version probe + actual ccusage daily + codex attempt
    expect(mockExecFileSync).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBe(todayStr());
  });

  it("returning user with very stale last_push_date: caps at 7 days", async () => {
    seedConfig({ last_push_date: daysAgoStr(30) });

    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand();

    // 3 execFileSync calls: ccusage --version probe + actual ccusage daily + codex attempt
    expect(mockExecFileSync).toHaveBeenCalledTimes(3);
    // calls[0] = version probe, calls[1] = actual ccusage daily
    const args = mockExecFileSync.mock.calls[1]!;
    // ccusage is called with: ["daily", "--json", "--since", ..., "--until", ...]
    const sinceIdx = (args[1] as string[]).indexOf("--since");
    const sinceDate = (args[1] as string[])[sinceIdx + 1]!;
    // Since date should be 6 days ago (7 days including today)
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const expectedSince = `${sixDaysAgo.getFullYear()}${String(sixDaysAgo.getMonth() + 1).padStart(2, "0")}${String(sixDaysAgo.getDate()).padStart(2, "0")}`;
    expect(sinceDate).toBe(expectedSince);
  });
});

// ===========================================================================
// 1b. CODEX INTEGRATION — merged Claude + Codex data
// ===========================================================================

describe("Codex integration", () => {
  /** Builds @ccusage/codex-style JSON for a single day. */
  function codexJson(dates: string[]) {
    return JSON.stringify({
      daily: dates.map((date) => ({
        date,
        modelsUsed: ["gpt-5-codex"],
        inputTokens: 2000,
        outputTokens: 800,
        totalTokens: 2800,
        totalCost: 3.0,
      })),
      totals: {
        inputTokens: 2000,
        outputTokens: 800,
        totalTokens: 2800,
        totalCost: 3.0,
      },
    });
  }

  /** Mock that returns ccusage JSON for ccusage calls and codex JSON for codex calls. */
  function mockBothSources(ccJson: string, codexJsonStr: string) {
    mockExecFileSync.mockImplementation(((cmd: string, args: string[]) => {
      if (args?.some?.((a: string) => typeof a === "string" && a.includes("@ccusage/codex"))) {
        return codexJsonStr;
      }
      return ccJson;
    }) as typeof execFileSync);
  }

  it("merges Claude + Codex data when both are available", async () => {
    seedConfig();
    const today = todayStr();
    mockBothSources(ccusageJson([today]), codexJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    // Verify the API call was made
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);

    // Should have merged data
    expect(body.entries).toHaveLength(1);
    const data = body.entries[0].data;
    expect(data.costUSD).toBe(3.05); // 0.05 (Claude) + 3.0 (Codex)
    expect(data.inputTokens).toBe(3000); // 1000 + 2000
    expect(data.outputTokens).toBe(1300); // 500 + 800
    expect(data.totalTokens).toBe(4300); // 1500 + 2800
    expect(data.models).toContain("claude-sonnet-4-6");
    expect(data.models).toContain("gpt-5-codex");

    // model_breakdown should have per-source cost entries
    expect(data.modelBreakdown).toHaveLength(2);
    expect(data.modelBreakdown).toContainEqual({ model: "claude-sonnet-4-6", cost_usd: 0.05 });
    expect(data.modelBreakdown).toContainEqual({ model: "gpt-5-codex", cost_usd: 3.0 });
  });

  it("hash includes both Claude and Codex raw JSON", async () => {
    seedConfig();
    const today = todayStr();
    const ccRaw = ccusageJson([today]);
    const codexRaw = codexJson([today]);
    mockBothSources(ccRaw, codexRaw);
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);

    // Hash should be SHA-256 of concatenated raw JSONs
    const { createHash } = await import("node:crypto");
    const expectedHash = createHash("sha256").update(ccRaw + codexRaw).digest("hex");
    expect(body.hash).toBe(expectedHash);
  });

  it("Codex-only day (no Claude data) still submits", async () => {
    seedConfig();
    const today = todayStr();

    // ccusage returns empty, Codex has data
    mockExecFileSync.mockImplementation(((cmd: string, args: string[]) => {
      if (args?.some?.((a: string) => typeof a === "string" && a.includes("@ccusage/codex"))) {
        return codexJson([today]);
      }
      return "[]"; // ccusage: no data
    }) as typeof execFileSync);

    mockSuccessfulSubmit([today]);

    await pushCommand({});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);
    const data = body.entries[0].data;

    expect(data.models).toEqual(["gpt-5-codex"]);
    expect(data.costUSD).toBe(3.0);
    expect(data.modelBreakdown).toEqual([{ model: "gpt-5-codex", cost_usd: 3.0 }]);
  });

  it("dry-run shows merged Codex models in summary", async () => {
    seedConfig();
    const today = todayStr();
    mockBothSources(ccusageJson([today]), codexJson([today]));

    await pushCommand({ dryRun: true });

    expect(mockFetch).not.toHaveBeenCalled();
    // Should print model names in summary
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("gpt-5-codex"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("dry run"),
    );
  });

  it("Codex failure is silent — Claude data still pushes", async () => {
    seedConfig();
    const today = todayStr();
    // ccusage works, codex throws
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);
    const data = body.entries[0].data;

    // Only Claude data
    expect(data.models).toEqual(["claude-sonnet-4-6"]);
    expect(data.costUSD).toBe(0.05);
    // No console.error about Codex
    const errorCalls = (console.error as any).mock.calls.map((c: any[]) => c[0]);
    expect(errorCalls.every((msg: string) => !msg.includes("codex"))).toBe(true);
  });
});

// ===========================================================================
// 2. API ERROR HANDLING — the kind of bug that prompted this test suite
// ===========================================================================

describe("API error handling during push", () => {
  it("404 Not Found — surfaces error clearly", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Endpoint not found"),
    );
  });

  it("401 Unauthorized — surfaces auth error", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Session expired"),
    );
  });

  it("500 Internal Server Error — surfaces server error", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

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

  it("network failure — surfaces connection error", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(pushCommand({})).rejects.toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("fetch failed"),
    );
  });

  it("404 during sync flow — surfaces error, does not save last_push_date", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    await expect(syncCommand()).rejects.toThrow(ExitError);

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBeUndefined();
  });
});

// ===========================================================================
// 3. API ENDPOINT VERIFICATION — exact paths matter
// ===========================================================================

describe("API endpoint paths", () => {
  it("push submits to /api/usage/submit", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://straude.com/api/usage/submit");
  });

  it("push sends POST method", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const [, options] = mockFetch.mock.calls[0]!;
    expect(options.method).toBe("POST");
  });

  it("push sends Authorization header", async () => {
    seedConfig({ token: "my-jwt-token" });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const [, options] = mockFetch.mock.calls[0]!;
    expect(options.headers.Authorization).toBe("Bearer my-jwt-token");
  });

  it("push sends correct body shape", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("entries");
    expect(body).toHaveProperty("hash");
    expect(body).toHaveProperty("source", "cli");
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toHaveProperty("date", today);
    expect(body.entries[0]).toHaveProperty("data");
    expect(body.entries[0].data).toHaveProperty("costUSD", 0.05);
    expect(body.entries[0].data).toHaveProperty("models", ["claude-sonnet-4-6"]);
  });

  it("login init calls /api/auth/cli/init", async () => {
    // No config → triggers login
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
          Promise.resolve({ status: "completed", token: "tok-1", username: "alice" }),
      });

    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand("https://straude.com");

    const [initUrl] = mockFetch.mock.calls[0]!;
    expect(initUrl).toBe("https://straude.com/api/auth/cli/init");

    const [pollUrl] = mockFetch.mock.calls[1]!;
    expect(pollUrl).toBe("https://straude.com/api/auth/cli/poll");
  });
});

// ===========================================================================
// 4. CONFIG PERSISTENCE — last_push_date tracking
// ===========================================================================

describe("config persistence", () => {
  it("saves last_push_date after successful push", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBe(today);
  });

  it("saves latest date when pushing multiple days", async () => {
    seedConfig();
    const dates = [daysAgoStr(2), daysAgoStr(1), todayStr()];
    mockCcusageOnly(ccusageJson(dates));
    mockSuccessfulSubmit(dates);

    await pushCommand({ days: 3 });

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBe(todayStr());
  });

  it("does not save last_push_date on dry run", async () => {
    seedConfig();
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));

    await pushCommand({ dryRun: true });

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBeUndefined();
  });

  it("does not save last_push_date when no data found", async () => {
    seedConfig();
    mockExecFileSync.mockReturnValue("[]");

    await pushCommand({});

    const saved = readPersistedConfig();
    expect(saved.last_push_date).toBeUndefined();
  });

  it("does not overwrite other config fields", async () => {
    seedConfig({ token: "original-token", username: "bob" });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await pushCommand({});

    const saved = readPersistedConfig();
    expect(saved.token).toBe("original-token");
    expect(saved.username).toBe("bob");
    expect(saved.last_push_date).toBe(today);
  });
});

// ===========================================================================
// 5. --api-url OVERRIDE — the bug that prompted this test suite
// ===========================================================================

describe("--api-url override", () => {
  it("sync uses override URL instead of stored config URL", async () => {
    // Config saved with port 3000, but dev server is on 3001
    seedConfig({ api_url: "http://localhost:3000" });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand("http://localhost:3001");

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/api/usage/submit");
  });

  it("push with configOverride uses override URL", async () => {
    seedConfig({ api_url: "http://localhost:3000" });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    const override = { ...makeConfig(), api_url: "http://localhost:3001" };
    await pushCommand({}, override);

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/api/usage/submit");
  });

  it("sync without override uses stored config URL", async () => {
    seedConfig({ api_url: "http://localhost:3000" });
    const today = todayStr();
    mockCcusageOnly(ccusageJson([today]));
    mockSuccessfulSubmit([today]);

    await syncCommand(); // no override

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/usage/submit");
  });
});

// ===========================================================================
// 6. CCUSAGE FAILURE HANDLING
// ===========================================================================

describe("ccusage failures during flow", () => {
  it("ccusage not installed — clear error message", async () => {
    seedConfig();
    mockExecFileSync.mockImplementation(() => {
      const err = new Error("ccusage not found") as Error & { status: number; stderr: string };
      err.status = 127;
      err.stderr = "ccusage: not found";
      throw err;
    });

    await expect(syncCommand()).rejects.toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("ccusage failed"),
    );
  });

  it("ccusage returns invalid JSON — clear error message", async () => {
    seedConfig();
    mockCcusageOnly("not json at all");

    await expect(syncCommand()).rejects.toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("parse"),
    );
  });
});
