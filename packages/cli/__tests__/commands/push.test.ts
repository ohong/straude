import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiRequestMock,
  collectMock,
  loadConfigMock,
  updateConfigMock,
  loginMock,
  pendingBatches,
  upsertBatchMock,
  removeBatchMock,
  releaseMock,
  acknowledgeQueuedDatesMock,
} = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  collectMock: vi.fn(),
  loadConfigMock: vi.fn(),
  updateConfigMock: vi.fn(),
  loginMock: vi.fn(),
  pendingBatches: [] as unknown[],
  upsertBatchMock: vi.fn(),
  removeBatchMock: vi.fn(),
  releaseMock: vi.fn(),
  acknowledgeQueuedDatesMock: vi.fn(),
}));

vi.mock("../../src/lib/auth.js", () => ({
  loadConfig: loadConfigMock,
  updateConfig: updateConfigMock,
}));

vi.mock("../../src/commands/login.js", () => ({
  loginCommand: loginMock,
  NonInteractiveLoginError: class NonInteractiveLoginError extends Error {},
}));

vi.mock("../../src/lib/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/api.js")>();
  return { ...actual, apiRequest: apiRequestMock };
});

vi.mock("../../src/lib/ccusage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ccusage.js")>();
  return {
    ...actual,
    collectCcusageUsageAsync: collectMock,
    resolveLocalTimezone: () => "America/Vancouver",
  };
});

vi.mock("../../src/lib/machine-id.js", () => ({
  getInstallationId: () => "11111111-1111-4111-8111-111111111111",
  getDistinctId: () => "alice",
}));

vi.mock("../../src/lib/prompt.js", () => ({
  isInteractive: () => true,
}));

vi.mock("../../src/lib/sync-state.js", () => ({
  acquireSyncLease: vi.fn(async () => ({
    queuedDates: [],
    acknowledgeQueuedDates: acknowledgeQueuedDatesMock,
    release: releaseMock,
  })),
  loadPendingBatches: vi.fn(() => [...pendingBatches]),
  upsertPendingBatch: upsertBatchMock,
  removePendingBatch: removeBatchMock,
}));

vi.mock("../../src/lib/telemetry.js", () => ({
  reportUsagePushFailed: vi.fn(),
  shutdownTelemetryWithTimeout: vi.fn(async () => 0),
  TELEMETRY_SHUTDOWN_TIMEOUT_MS: 150,
  errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock("../../src/lib/posthog.js", () => ({
  posthog: { capture: vi.fn() },
}));

vi.mock("ink", () => ({
  render: vi.fn(() => ({ waitUntilExit: () => Promise.resolve() })),
}));

import {
  CLI_EXIT,
  pushCommand,
} from "../../src/commands/push.js";
import { PricingUnavailableError } from "../../src/lib/ccusage.js";

const today = "2026-03-13";
const priorDevice = "22222222-2222-4222-8222-222222222222";

function config(overrides: Record<string, unknown> = {}) {
  return {
    token: "tok",
    username: "alice",
    api_url: "https://straude.com",
    device_id: priorDevice,
    device_name: "work-laptop",
    last_push_date: "2026-03-12",
    usage_protocol_v2_migration_completed_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function usageEntry(date = today) {
  return {
    date,
    agents: ["codex"],
    agentBreakdown: [{
      agent: "codex",
      models: ["gpt-5"],
      inputTokens: 10,
      outputTokens: 3,
      reasoningOutputTokens: 2,
      cacheCreationTokens: 0,
      cacheReadTokens: 5,
      totalTokens: 20,
      costUSD: 0.02,
      modelBreakdown: [{
        model: "gpt-5",
        inputTokens: 10,
        outputTokens: 3,
        reasoningOutputTokens: 2,
        cacheCreationTokens: 0,
        cacheReadTokens: 5,
        totalTokens: 20,
        cost_usd: 0.02,
      }],
    }],
    models: ["gpt-5"],
    inputTokens: 10,
    outputTokens: 3,
    reasoningOutputTokens: 2,
    cacheCreationTokens: 0,
    cacheReadTokens: 5,
    totalTokens: 20,
    costUSD: 0.02,
    modelBreakdown: [{
      model: "gpt-5",
      inputTokens: 10,
      outputTokens: 3,
      reasoningOutputTokens: 2,
      cacheCreationTokens: 0,
      cacheReadTokens: 5,
      totalTokens: 20,
      cost_usd: 0.02,
    }],
  };
}

function collected(entries = [usageEntry()]) {
  return {
    data: entries,
    summary: {
      totalInputTokens: 10,
      totalOutputTokens: 3,
      totalReasoningOutputTokens: 2,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 5,
      totalTokens: 20,
      totalCostUSD: 0.02,
    },
    agents: ["codex"],
    collector: {
      codex: "ccusage-codex-v20",
      ccusage_version: "20.0.18",
      ccusage_agents: ["codex"],
      pricing_mode: "online",
    },
    version: "20.0.18",
    raw: "{}",
    stderr: "",
  };
}

function outcome(
  requestId: string,
  date: string,
  status: "committed" | "unchanged" | "retryable_error" = "committed",
) {
  return {
    request_id: requestId,
    outcomes: [{
      date,
      status,
      ...(status !== "retryable_error"
        ? {
          result: {
            usage_id: `usage-${date}`,
            post_id: `post-${date}`,
            post_url: `https://straude.com/post/${date}`,
            action: "created",
          },
        }
        : {}),
      ...(status === "retryable_error"
        ? { error: { code: "TRANSIENT", message: "retry" } }
        : {}),
    }],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-03-13T20:00:00.000Z"), toFake: ["Date"] });
  vi.clearAllMocks();
  pendingBatches.splice(0);
  const initial = config();
  loadConfigMock.mockReturnValue(initial);
  updateConfigMock.mockImplementation((updater) => updater(initial));
  collectMock.mockResolvedValue(collected());
  upsertBatchMock.mockImplementation((batch) => {
    const index = pendingBatches.findIndex(
      (candidate: { request: { request_id: string } }) =>
        candidate.request.request_id === batch.request.request_id,
    );
    if (index === -1) pendingBatches.push(batch);
    else pendingBatches[index] = batch;
  });
  removeBatchMock.mockImplementation((requestId) => {
    const index = pendingBatches.findIndex(
      (candidate: { request: { request_id: string } }) =>
        candidate.request.request_id === requestId,
    );
    if (index >= 0) pendingBatches.splice(index, 1);
  });
  apiRequestMock.mockImplementation(async (_config, path, options) => {
    if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
    const body = JSON.parse(options.body);
    return outcome(body.request_id, body.entries[0].date);
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("pushCommand v2", () => {
  it("persists and submits a validated per-agent v2 request", async () => {
    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.OK);
    expect(upsertBatchMock).toHaveBeenCalledBefore(apiRequestMock);
    const submitCall = apiRequestMock.mock.calls.find(([, path]) => path === "/api/usage/submit")!;
    const body = JSON.parse(submitCall[2].body);
    expect(body).toMatchObject({
      protocol_version: 2,
      timezone: "America/Vancouver",
      installation: {
        id: "11111111-1111-4111-8111-111111111111",
        previous_device_id: priorDevice,
        name: "work-laptop",
      },
      collector: {
        name: "ccusage",
        version: "20.0.18",
        pricing_mode: "online",
      },
    });
    expect(body.entries[0].agents[0]).toMatchObject({
      agent: "codex",
      reasoning_output_tokens: 2,
      total_tokens: 20,
      model_breakdown: [{ model: "gpt-5", total_tokens: 20 }],
    });
    expect(body.entries[0].content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(submitCall[2].headers).toEqual({
      "X-Straude-CLI-Version": "0.2.0",
      "X-Straude-Retry-Attempt": "0",
    });
    expect(removeBatchMock).toHaveBeenCalledWith(body.request_id);
    expect(updateConfigMock).toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalled();
  });

  it("retries only failed dates with the same request id", async () => {
    collectMock.mockResolvedValue(collected([
      usageEntry("2026-03-12"),
      usageEntry("2026-03-13"),
    ]));
    let call = 0;
    apiRequestMock.mockImplementation(async (_config, path, options) => {
      if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
      const body = JSON.parse(options.body);
      call += 1;
      if (call === 1) {
        return {
          request_id: body.request_id,
          outcomes: [
            outcome(body.request_id, "2026-03-12").outcomes[0],
            outcome(body.request_id, "2026-03-13", "retryable_error").outcomes[0],
          ],
        };
      }
      return outcome(body.request_id, "2026-03-13", "unchanged");
    });

    const exitCode = await pushCommand({ days: 2 });

    expect(exitCode).toBe(CLI_EXIT.OK);
    const submitCalls = apiRequestMock.mock.calls.filter(([, path]) => path === "/api/usage/submit");
    const first = JSON.parse(submitCalls[0]![2].body);
    const second = JSON.parse(submitCalls[1]![2].body);
    expect(second.request_id).toBe(first.request_id);
    expect(second.entries.map((entry: { date: string }) => entry.date)).toEqual(["2026-03-13"]);
    expect(pendingBatches).toEqual([]);
  });

  it("keeps the committed outbox entry when watermark persistence crashes", async () => {
    updateConfigMock.mockImplementation(() => {
      throw new Error("injected config fsync failure");
    });

    await expect(pushCommand({})).rejects.toThrow("injected config fsync failure");

    expect(pendingBatches).toHaveLength(1);
    expect(removeBatchMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalled();
  });

  it("retains unresolved partials and returns temporary failure", async () => {
    apiRequestMock.mockImplementation(async (_config, path, options) => {
      if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
      const body = JSON.parse(options.body);
      return outcome(body.request_id, body.entries[0].date, "retryable_error");
    });

    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.TEMPORARY);
    expect(apiRequestMock.mock.calls.filter(([, path]) => path === "/api/usage/submit")).toHaveLength(3);
    expect(pendingBatches).toHaveLength(1);
    expect(updateConfigMock).not.toHaveBeenCalled();
  });

  it("removes permanently rejected dates from the retry outbox", async () => {
    collectMock.mockResolvedValue(collected([
      usageEntry("2026-03-12"),
      usageEntry("2026-03-13"),
    ]));
    apiRequestMock.mockImplementation(async (_config, path, options) => {
      if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
      const body = JSON.parse(options.body);
      return {
        request_id: body.request_id,
        outcomes: [
          outcome(body.request_id, "2026-03-12").outcomes[0],
          {
            date: "2026-03-13",
            status: "permanent_error",
            error: { code: "INVALID_USAGE", message: "invalid usage" },
          },
        ],
      };
    });

    const exitCode = await pushCommand({ days: 2 });

    expect(exitCode).toBe(CLI_EXIT.PERMANENT);
    expect(pendingBatches).toEqual([]);
    expect(updateConfigMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("permanently rejected"),
    );
  });

  it("keeps only retryable dates and caps their future watermark before a permanent gap", async () => {
    loadConfigMock.mockReturnValue(config({ last_push_date: "2026-03-10" }));
    collectMock.mockResolvedValue(collected([
      usageEntry("2026-03-11"),
      usageEntry("2026-03-12"),
      usageEntry("2026-03-13"),
    ]));
    apiRequestMock.mockImplementation(async (_config, path, options) => {
      if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
      const body = JSON.parse(options.body);
      return {
        request_id: body.request_id,
        outcomes: body.entries.map((entry: { date: string }) => {
          if (entry.date === "2026-03-11") {
            return outcome(body.request_id, entry.date).outcomes[0];
          }
          if (entry.date === "2026-03-12") {
            return {
              date: entry.date,
              status: "permanent_error",
              error: { code: "INVALID_USAGE", message: "invalid usage" },
            };
          }
          return outcome(body.request_id, entry.date, "retryable_error").outcomes[0];
        }),
      };
    });

    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.PERMANENT);
    expect(pendingBatches).toHaveLength(1);
    expect((pendingBatches[0] as {
      request: { entries: Array<{ date: string }> };
      watermark_date?: string;
    })).toMatchObject({
      request: { entries: [{ date: "2026-03-13" }] },
      watermark_date: "2026-03-11",
    });
  });

  it("surfaces structured HTTP 409 identity conflicts through device resolution", async () => {
    apiRequestMock.mockImplementation(async (_config, path, options) => {
      if (path === "/api/cli/dashboard") throw new Error("dashboard unavailable");
      const body = JSON.parse(options.body);
      return {
        request_id: body.request_id,
        outcomes: [{
          date: body.entries[0].date,
          status: "identity_conflict",
          error: {
            code: "device_reconciliation_required",
            message: "Device identity must be resolved",
          },
        }],
      };
    });

    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.PERMANENT);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("straude devices"),
    );
    expect(pendingBatches).toHaveLength(1);
    const submitCall = apiRequestMock.mock.calls.find(
      ([, path]) => path === "/api/usage/submit",
    )!;
    expect(submitCall[2]).toMatchObject({
      maxRetries: 0,
      acceptedStatuses: [400, 409, 503],
    });
  });

  it("renders only the newly collected local payload during dry-run", async () => {
    const exitCode = await pushCommand({ dryRun: true });

    expect(exitCode).toBe(CLI_EXIT.OK);
    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(upsertBatchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("nothing submitted"));
  });

  it("keeps a committed sync successful when the dashboard is unavailable", async () => {
    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.OK);
    expect(console.log).toHaveBeenCalledWith("Usage synced; dashboard unavailable.");
  });

  it("returns temporary failure for unavailable live pricing without advancing state", async () => {
    collectMock.mockRejectedValue(new PricingUnavailableError("embedded fallback"));

    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.TEMPORARY);
    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(updateConfigMock).not.toHaveBeenCalled();
  });

  it("fails fast with AUTH_REQUIRED in background execution", async () => {
    loadConfigMock.mockReturnValue(null);

    const exitCode = await pushCommand({ nonInteractive: true });

    expect(exitCode).toBe(CLI_EXIT.AUTH_REQUIRED);
    expect(loginMock).not.toHaveBeenCalled();
    expect(collectMock).not.toHaveBeenCalled();
  });

  it("advances an empty automatic range and writes the v2 migration marker", async () => {
    const legacy = config({
      last_push_date: undefined,
      usage_protocol_v2_migration_completed_at: undefined,
      ccusage_v20_migration_completed_at: "legacy",
      codex_native_repair_completed_at: "legacy",
    });
    loadConfigMock.mockReturnValue(legacy);
    updateConfigMock.mockImplementation((updater) => updater(legacy));
    collectMock.mockResolvedValue(collected([]));

    const exitCode = await pushCommand({});

    expect(exitCode).toBe(CLI_EXIT.OK);
    const next = updateConfigMock.mock.results[0]!.value;
    expect(next.last_push_date).toBe(today);
    expect(next.usage_protocol_v2_migration_completed_at).toEqual(expect.any(String));
    expect(next.ccusage_v20_migration_completed_at).toBeUndefined();
    expect(next.codex_native_repair_completed_at).toBeUndefined();
  });
});
