import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliTokenWithRefresh: vi.fn(() => ({
    userId: "user-v2",
    username: "v2-user",
    refreshedToken: null,
  })),
}));

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ rpc, from })),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/usage/submit/route";
import { resetRateLimiters } from "@/lib/rate-limit";

const DATE = new Date().toISOString().slice(0, 10);
const INSTALLATION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function agent() {
  return {
    agent: "codex",
    models: ["gpt-5.6"],
    input_tokens: 100,
    output_tokens: 20,
    reasoning_output_tokens: 10,
    cache_creation_tokens: 0,
    cache_read_tokens: 30,
    total_tokens: 160,
    cost_usd: 0.25,
    model_breakdown: [{
      model: "gpt-5.6",
      input_tokens: 100,
      output_tokens: 20,
      reasoning_output_tokens: 10,
      cache_creation_tokens: 0,
      cache_read_tokens: 30,
      total_tokens: 160,
      cost_usd: 0.25,
    }],
  };
}

function requestBody() {
  return {
    protocol_version: 2,
    request_id: "request-v2",
    source: "cli",
    timezone: "America/Vancouver",
    installation: { id: INSTALLATION_ID, name: "work-laptop" },
    collector: { name: "ccusage", version: "20.0.16", pricing_mode: "online" },
    entries: [{
      date: DATE,
      content_hash: "a".repeat(64),
      agents: [agent()],
    }],
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer token",
      "X-Straude-CLI-Version": "0.2.0",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimiters();
  process.env.NEXT_PUBLIC_APP_URL = "https://straude.com";
  rpc.mockImplementation((name: string) => {
    if (name === "check_rate_limit") {
      return Promise.resolve({
        data: [{ allowed: true, retry_after_seconds: 0 }],
        error: null,
      });
    }
    return Promise.resolve({
      data: {
        date: DATE,
        status: "committed",
        result: {
          usage_id: "usage-1",
          post_id: "post-1",
          post_url: "https://straude.com/post/post-1",
          action: "created",
          daily_total: 0.25,
          device_count: 1,
        },
      },
      error: null,
    });
  });
});

describe("POST /api/usage/submit protocol v2", () => {
  it("validates v2 before touching the database", async () => {
    const body = requestBody();
    body.entries[0]!.agents[0]!.cost_usd = 0.24;

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_agent_aggregate" },
    });
    expect(rpc).not.toHaveBeenCalledWith("submit_usage_day_v2", expect.anything());
  });

  it("commits each date through the transactional v2 RPC", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await POST(request(requestBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      request_id: "request-v2",
      outcomes: [{
        date: DATE,
        status: "committed",
        result: { usage_id: "usage-1", post_id: "post-1" },
      }],
    });
    expect(rpc).toHaveBeenCalledWith("submit_usage_day_v2", expect.objectContaining({
      p_user_id: "user-v2",
      p_request_id: "request-v2",
      p_source: "cli",
      p_timezone: "America/Vancouver",
      p_installation: expect.objectContaining({ id: INSTALLATION_ID }),
      p_entry: expect.objectContaining({ date: DATE, agents: [agent()] }),
    }));
    expect(from).not.toHaveBeenCalledWith("device_usage");
    expect(from).not.toHaveBeenCalledWith("daily_usage");
    expect(from).not.toHaveBeenCalledWith("posts");
    const structuredLogs = log.mock.calls.map((call) => JSON.parse(String(call[0])));
    const structuredLog = structuredLogs.find((entry) => entry.event === "usage_submit_day");
    expect(structuredLog).toMatchObject({
      event: "usage_submit_day",
      protocol_version: 2,
      request_id: "request-v2",
      date: DATE,
      collector_version: "20.0.16",
      cli_version: "0.2.0",
      outcome: "committed",
      retry_count: 0,
      stage_timings_ms: {
        transaction: expect.any(Number),
        total: expect.any(Number),
      },
    });
    expect(JSON.stringify(structuredLog)).not.toContain(INSTALLATION_ID);
    expect(JSON.stringify(structuredLog)).not.toContain("work-laptop");
    expect(structuredLogs).toContainEqual(expect.objectContaining({
      event: "usage_submit_request",
      protocol_version: 2,
      request_id: "request-v2",
      cli_version: "0.2.0",
      http_status: 200,
      unresolved_partial: false,
      submit_duration_ms: expect.any(Number),
    }));
    log.mockRestore();
  });

  it("returns unchanged when the RPC replays the same request/date/content", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "check_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
      }
      return Promise.resolve({
        data: {
          date: DATE,
          status: "unchanged",
          result: { usage_id: "usage-1", post_id: "post-1", action: "updated" },
        },
        error: null,
      });
    });

    const response = await POST(request(requestBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcomes: [{ status: "unchanged" }],
    });
  });

  it("maps a conflicting retry of request_id plus date to HTTP 409", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "check_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
      }
      return Promise.resolve({
        data: {
          date: DATE,
          status: "identity_conflict",
          error: {
            code: "idempotency_conflict",
            message: "request_id and date already committed with different content",
          },
        },
        error: null,
      });
    });

    const response = await POST(request(requestBody()));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      request_id: "request-v2",
      outcomes: [{
        status: "identity_conflict",
        error: { code: "idempotency_conflict" },
      }],
    });
  });

  it("returns HTTP 207 with every outcome when a v2 batch partially succeeds", async () => {
    const prior = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const body = requestBody();
    body.entries.push({
      ...structuredClone(body.entries[0]!),
      date: prior,
      content_hash: "b".repeat(64),
    });
    rpc.mockImplementation((name: string, params: { p_entry?: { date?: string } }) => {
      if (name === "check_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
      }
      if (params.p_entry?.date === DATE) {
        return Promise.resolve({
          data: { date: DATE, status: "unchanged" },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          date: prior,
          status: "retryable_error",
          error: { code: "database_busy", message: "Try again" },
        },
        error: null,
      });
    });

    const response = await POST(request(body));

    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({
      outcomes: [
        { date: DATE, status: "unchanged" },
        { date: prior, status: "retryable_error" },
      ],
    });
  });

  it("rejects a source that disagrees with the authenticated channel", async () => {
    const body = requestBody();
    body.source = "web";

    const response = await POST(request(body));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      request_id: "request-v2",
      outcomes: [{
        status: "permanent_error",
        error: { code: "source_mismatch" },
      }],
    });
    expect(rpc).not.toHaveBeenCalledWith("submit_usage_day_v2", expect.anything());
  });

  it("keeps legacy response shape but fails the whole HTTP request when any date fails", async () => {
    let submitCalls = 0;
    rpc.mockImplementation((name: string) => {
      if (name === "check_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
      }
      submitCalls += 1;
      if (submitCalls === 1) {
        return Promise.resolve({
          data: {
            date: DATE,
            status: "committed",
            result: {
              usage_id: "usage-1",
              post_id: "post-1",
              post_url: "https://straude.com/post/post-1",
              action: "created",
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "database unavailable" } });
    });
    const prior = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const legacyEntry = (date: string) => ({
      date,
      data: {
        date,
        agents: ["codex"],
        models: ["gpt-5.6"],
        inputTokens: 100,
        outputTokens: 20,
        reasoningOutputTokens: 10,
        cacheCreationTokens: 0,
        cacheReadTokens: 30,
        totalTokens: 160,
        costUSD: 0.25,
        modelBreakdown: [{ model: "gpt-5.6", cost_usd: 0.25 }],
      },
    });

    const response = await POST(request({
      entries: [legacyEntry(DATE), legacyEntry(prior)],
      hash: "b".repeat(64),
      source: "cli",
      device_id: INSTALLATION_ID,
      device_name: "work-laptop",
    }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).not.toBe(207);
    expect(await response.json()).toMatchObject({
      results: [{ date: DATE }],
      errors: ["Usage transaction is temporarily unavailable"],
    });
    expect(rpc).toHaveBeenCalledWith("submit_usage_day_v2", expect.anything());
    expect(from).not.toHaveBeenCalledWith("device_usage");
    expect(from).not.toHaveBeenCalledWith("daily_usage");
    expect(from).not.toHaveBeenCalledWith("posts");
  });

  it("derives stable legacy idempotency and keeps legacy rows unpartitioned", async () => {
    const legacy = {
      entries: [{
        date: DATE,
        data: {
          date: DATE,
          agents: ["codex"],
          models: ["gpt-5.6"],
          inputTokens: 100,
          outputTokens: 20,
          reasoningOutputTokens: 10,
          cacheCreationTokens: 0,
          cacheReadTokens: 30,
          totalTokens: 160,
          costUSD: 0.25,
          modelBreakdown: [{ model: "gpt-5.6", cost_usd: 0.25 }],
        },
      }],
      source: "cli",
      device_id: INSTALLATION_ID,
      device_name: "work-laptop",
    };

    await POST(request(legacy));
    await POST(request(legacy));

    const submissions = rpc.mock.calls
      .filter(([name]) => name === "submit_usage_day_v2")
      .map(([, params]) => params);
    expect(submissions).toHaveLength(2);
    expect(submissions[0].p_request_id).toMatch(/^[a-f0-9]{64}$/);
    expect(submissions[1].p_request_id).toBe(submissions[0].p_request_id);
    expect(submissions[0].p_entry.agents).toEqual([
      expect.objectContaining({ agent: "legacy-unpartitioned" }),
    ]);
  });
});
