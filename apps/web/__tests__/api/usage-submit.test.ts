import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliTokenWithRefresh: vi.fn(),
}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ rpc })),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/usage/submit/route";
import { createClient } from "@/lib/supabase/server";
import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { resetRateLimiters } from "@/lib/rate-limit";

const DEVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DATE = new Date().toISOString().slice(0, 10);

function legacyEntry(date = DATE) {
  return {
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
  };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function legacyBody(entries = [legacyEntry()]) {
  return {
    entries,
    hash: "a".repeat(64),
    source: "cli",
    device_id: DEVICE_ID,
    device_name: "work-laptop",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimiters();
  process.env.NEXT_PUBLIC_APP_URL = "https://straude.com";
  vi.mocked(verifyCliTokenWithRefresh).mockReturnValue({
    userId: "user-1",
    username: "user",
    refreshedToken: null,
  });
  rpc.mockImplementation((name: string, params: Record<string, unknown>) => {
    if (name === "check_rate_limit") {
      return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    }
    if (name !== "submit_usage_day_v2") {
      return Promise.resolve({ data: null, error: null });
    }
    const entry = params.p_entry as { date: string };
    return Promise.resolve({
      data: {
        date: entry.date,
        status: "committed",
        result: {
          usage_id: `usage-${entry.date}`,
          post_id: `post-${entry.date}`,
          action: "created",
          daily_total: 0.25,
          device_count: 1,
        },
      },
      error: null,
    });
  });
});

describe("POST /api/usage/submit legacy adapter", () => {
  it("returns 426 with the exact update command after the configured v1 sunset", async () => {
    vi.stubEnv("STRAUDE_USAGE_V1_CUTOFF", "2000-01-01");

    const response = await POST(request(legacyBody()));

    expect(response.status).toBe(426);
    expect(await response.json()).toEqual({
      error: "This Straude CLI version is no longer supported.",
      code: "usage_protocol_upgrade_required",
      update_command: "npx straude@latest",
    });
    expect(rpc).not.toHaveBeenCalledWith("submit_usage_day_v2", expect.anything());
    vi.unstubAllEnvs();
  });

  it("keeps authenticated web imports available after the CLI v1 sunset", async () => {
    vi.stubEnv("STRAUDE_USAGE_V1_CUTOFF", "2000-01-01");
    vi.mocked(verifyCliTokenWithRefresh).mockReturnValue(null);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "web-user" } } }),
      },
    } as never);

    const response = await POST(request({
      ...legacyBody(),
      source: "web",
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({ p_source: "web", p_is_verified: false }),
    );
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(verifyCliTokenWithRefresh).mockReturnValue(null);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const response = await POST(request(legacyBody()));

    expect(response.status).toBe(401);
  });

  it("adapts legacy entries through submit_usage_day_v2", async () => {
    const response = await POST(request(
      legacyBody(),
      { authorization: "Bearer token" },
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.results).toEqual([expect.objectContaining({
      date: DATE,
      usage_id: `usage-${DATE}`,
      post_url: `https://straude.com/post/post-${DATE}`,
    })]);
    expect(rpc).toHaveBeenCalledWith("submit_usage_day_v2", expect.objectContaining({
      p_request_id: "a".repeat(64),
      p_installation: { id: DEVICE_ID, name: "work-laptop" },
      p_entry: expect.objectContaining({
        date: DATE,
        agents: [expect.objectContaining({
          agent: "legacy-unpartitioned",
          input_tokens: 100,
          total_tokens: 160,
        })],
      }),
    }));
  });

  it("derives omitted legacy reasoning tokens from the declared total", async () => {
    const body = legacyBody();
    delete (body.entries[0]!.data as { reasoningOutputTokens?: number })
      .reasoningOutputTokens;

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_entry: expect.objectContaining({
          agents: [expect.objectContaining({
            reasoning_output_tokens: 10,
            total_tokens: 160,
          })],
        }),
      }),
    );
  });

  it("rejects duplicate dates before calling the transaction RPC", async () => {
    const response = await POST(request(legacyBody([legacyEntry(), legacyEntry()])));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: `Duplicate date: ${DATE}` });
    expect(rpc).not.toHaveBeenCalledWith("submit_usage_day_v2", expect.anything());
  });

  it("rejects mismatched inner and outer dates", async () => {
    const entry = legacyEntry();
    entry.data.date = "2026-07-22";

    const response = await POST(request(legacyBody([entry])));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("outside the 30-day backfill window"),
    });
  });

  it("rejects accounting totals that do not match token categories", async () => {
    const entry = legacyEntry();
    entry.data.totalTokens = 159;

    const response = await POST(request(legacyBody([entry])));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Token categories do not equal total tokens for ${DATE}`,
    });
  });

  it("rejects negative cache tokens", async () => {
    const entry = legacyEntry();
    entry.data.cacheReadTokens = -1;

    const response = await POST(request(legacyBody([entry])));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Invalid cache read tokens for ${DATE}`,
    });
  });

  it("rejects invalid JSON and oversized bodies", async () => {
    const invalid = await POST(new Request("http://localhost/api/usage/submit", {
      method: "POST",
      body: "{",
    }));
    expect(invalid.status).toBe(400);

    const oversized = await POST(request({
      ...legacyBody(),
      padding: "x".repeat(260 * 1024),
    }));
    expect(oversized.status).toBe(413);
  });

  it("returns non-2xx when the transaction RPC fails", async () => {
    rpc.mockImplementation((name: string) => name === "check_rate_limit"
      ? Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null })
      : Promise.resolve({ data: null, error: { code: "40001", message: "serialization failure" } }));

    const response = await POST(request(legacyBody()));

    expect(response.status).toBe(503);
    expect(response.status).not.toBe(207);
    expect(await response.json()).toMatchObject({
      error: "Usage transaction is temporarily unavailable",
      results: [],
      errors: ["Usage transaction is temporarily unavailable"],
    });
  });
});
