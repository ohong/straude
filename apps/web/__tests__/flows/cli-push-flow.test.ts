import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSessionClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSessionClient),
}));

vi.mock("@/lib/api/cli-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cli-auth")>();
  return {
    ...actual,
    createCliToken: vi.fn(() => "mock-cli-jwt-token"),
    verifyCliToken: vi.fn(),
    verifyCliTokenWithRefresh: vi.fn(),
  };
});

const mockServiceClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

import { verifyCliToken, verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";

/**
 * Auto-derive verifyCliTokenWithRefresh from verifyCliToken so existing
 * tests that set verifyCliToken's return value continue to work. Must be
 * called after vi.clearAllMocks() in each beforeEach.
 */
function autoDeriveCliAuthMocks() {
  (verifyCliTokenWithRefresh as ReturnType<typeof vi.fn>).mockImplementation(
    (header: string | null) => {
      const userId = (verifyCliToken as ReturnType<typeof vi.fn>)(header);
      return userId ? { userId, username: null, refreshedToken: null } : null;
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chainBuilder(resolved: Record<string, unknown> = {}) {
  const chain: Record<string, any> = {
    // Default query result properties — used when a chain ends with .eq()
    // instead of .single()/.maybeSingle() (e.g. device_usage fetch)
    data: [],
    error: null,
    count: 0,
  };
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in", "is",
    "order", "limit", "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

function makeRequest(url: string, init?: RequestInit) {
  const parsedUrl = new URL(url, "http://localhost:3000");
  const req = new Request(parsedUrl, init);
  (req as any).nextUrl = parsedUrl;
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: CLI Push", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-03-13T12:00:00Z'), toFake: ['Date'] });
    vi.clearAllMocks();
    autoDeriveCliAuthMocks();
    mockServiceClient.rpc.mockImplementation((fn: string, params?: Record<string, any>) => {
      if (fn === "check_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
      }
      if (fn === "submit_usage_day_v2") {
        return Promise.resolve({
          data: {
            date: params?.p_entry.date,
            status: "committed",
            result: {
              usage_id: "usage-1",
              post_id: "post-1",
              action: "created",
              daily_total: 0.05,
              device_count: 1,
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("CLI_JWT_SECRET", "test-jwt-secret");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CLI init creates an auth code and returns verify URL", async () => {
    const insertChain = chainBuilder({ data: null, error: null });
    (insertChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return insertChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/init/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/init", {
      method: "POST",
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status, JSON.stringify(data)).toBe(200);
    expect(data.code).toBeDefined();
    expect(data.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(data.verify_url).toContain("https://straude.com/cli/verify?code=");
    expect(data.poll_secret).toBeDefined();
    expect(mockServiceClient.from).toHaveBeenCalledWith("cli_auth_codes");
  });

  it("CLI poll returns pending when code not yet verified", async () => {
    const pendingCode = {
      id: "code-1",
      code: "ABCD-EFGH",
      status: "pending",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      user_id: null,
    };

    const selectChain = chainBuilder({ data: pendingCode, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return selectChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/poll/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-EFGH", poll_secret: "secret" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("pending");
  });

  it("CLI poll returns completed with token after user verifies", async () => {
    const userId = "user-cli-1";
    const completedCode = {
      id: "code-1",
      code: "ABCD-EFGH",
      status: "completed",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      user_id: userId,
    };

    const codeChain = chainBuilder({ data: completedCode, error: null });
    const userChain = chainBuilder({ data: { username: "cli_user" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return codeChain;
      if (table === "users") return userChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/poll/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-EFGH", poll_secret: "secret" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("completed");
    expect(data.token).toBe("mock-cli-jwt-token");
    expect(data.username).toBe("cli_user");
  });

  it("CLI pushes usage and creates daily_usage + post", async () => {
    const userId = "user-cli-1";

    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5-20250929"],
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationTokens: 100,
              cacheReadTokens: 200,
              totalTokens: 1800,
              costUSD: 0.05,
            },
          },
        ],
        hash: "abc123",
        source: "cli",
        device_id: "aaaaaaaa-0000-4000-8000-000000000001",
        device_name: "test-device",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status, JSON.stringify(data)).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].usage_id).toBe("usage-1");
    expect(data.results[0].post_id).toBe("post-1");
    expect(data.results[0].post_url).toBe("https://straude.com/post/post-1");

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_request_id: "abc123",
        p_is_verified: true,
        p_entry: expect.objectContaining({ date: today }),
      }),
    );
  });

  it("pushing same date again upserts instead of duplicating", async () => {
    const userId = "user-cli-1";
    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const entry = {
      date: today,
      data: {
        date: today,
        models: ["claude-sonnet-4-5-20250929"],
        inputTokens: 2000,
        outputTokens: 1000,
        cacheCreationTokens: 200,
        cacheReadTokens: 400,
        totalTokens: 3600,
        costUSD: 0.10,
      },
    };

    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({ entries: [entry], hash: "def456", source: "cli", device_id: "aaaaaaaa-0000-4000-8000-000000000001", device_name: "test-device" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_request_id: "def456",
        p_entry: expect.objectContaining({ date: today }),
      }),
    );
  });

  it("CLI pushes merged Claude + Codex data with model_breakdown", async () => {
    const userId = "user-cli-1";

    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });
    const deviceChain = chainBuilder({ data: { id: "dev-1" }, error: null });
    deviceChain.data = [{
      cost_usd: 13.0, input_tokens: 3000, output_tokens: 1300,
      cache_creation_tokens: 100, cache_read_tokens: 50, total_tokens: 4450,
      models: ["claude-opus-4-20250505", "gpt-5-codex"],
      model_breakdown: [{ model: "claude-opus-4-20250505", cost_usd: 10.0 }, { model: "gpt-5-codex", cost_usd: 3.0 }],
    }];

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "device_usage") return deviceChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-opus-4-20250505", "gpt-5-codex"],
              inputTokens: 3000,
              outputTokens: 1300,
              cacheCreationTokens: 100,
              cacheReadTokens: 50,
              totalTokens: 4450,
              costUSD: 13.0,
              modelBreakdown: [
                { model: "claude-opus-4-20250505", cost_usd: 10.0 },
                { model: "gpt-5-codex", cost_usd: 3.0 },
              ],
            },
          },
        ],
        hash: "merged-hash-123",
        source: "cli",
        device_id: "aaaaaaaa-0000-4000-8000-000000000001",
        device_name: "test-device",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].usage_id).toBe("usage-1");

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_entry: expect.objectContaining({
          agents: [expect.objectContaining({
            agent: "legacy-unpartitioned",
            cost_usd: 13,
            input_tokens: 3000,
            total_tokens: 4450,
          })],
        }),
      }),
    );
  });

  it("CLI pushes Codex-only data (no Claude models)", async () => {
    const userId = "user-cli-1";

    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-2" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-2" }, error: null });
    const deviceChain = chainBuilder({ data: { id: "dev-2" }, error: null });
    deviceChain.data = [{
      cost_usd: 3.20, input_tokens: 2000, output_tokens: 800,
      cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 2800,
      models: ["gpt-5-codex"],
      model_breakdown: [{ model: "gpt-5-codex", cost_usd: 3.20 }],
    }];

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "device_usage") return deviceChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["gpt-5-codex"],
              inputTokens: 2000,
              outputTokens: 800,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              totalTokens: 2800,
              costUSD: 3.20,
              modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 3.20 }],
            },
          },
        ],
        hash: "codex-only-hash",
        source: "cli",
        device_id: "aaaaaaaa-0000-4000-8000-000000000001",
        device_name: "test-device",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_entry: expect.objectContaining({
          agents: [expect.objectContaining({
            agent: "legacy-unpartitioned",
            models: ["gpt-5-codex"],
            cost_usd: 3.2,
          })],
        }),
      }),
    );
  });

  it("two devices push same day — daily_usage shows summed totals", async () => {
    const userId = "user-cli-1";
    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    // After first device push, device_usage will have one row
    // After second device push, device_usage will have two rows
    const deviceRowsAfterSecondPush = [
      {
        cost_usd: 5.0,
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 100,
        cache_read_tokens: 50,
        total_tokens: 1650,
        models: ["claude-opus-4-20250505"],
        model_breakdown: [{ model: "claude-opus-4-20250505", cost_usd: 5.0 }],
      },
      {
        cost_usd: 3.0,
        input_tokens: 2000,
        output_tokens: 800,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
        total_tokens: 2800,
        models: ["claude-sonnet-4-5-20250929"],
        model_breakdown: [{ model: "claude-sonnet-4-5-20250929", cost_usd: 3.0 }],
      },
    ];

    const dailyUsageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });

    // Stateless device_usage mock — routes by query shape, not call order:
    // Guard:  .select("cost_usd,models,model_breakdown,collector_meta").eq().eq().eq().maybeSingle()
    // Count:  .select("id", { count, head }).eq().eq()
    // Upsert: .upsert({}, {}).select().single()
    // Fetch:  .select("cost_usd,...").eq().eq()
    const deviceChain: Record<string, any> = {};
    deviceChain.select = vi.fn((columns?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.count === "exact" && options.head) {
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: 1, data: null, error: null })),
          })),
        };
      }
      if (columns === "cost_usd,models,model_breakdown,collector_meta") {
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        };
      }
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: deviceRowsAfterSecondPush, error: null })),
        })),
      };
    });
    deviceChain.upsert = vi.fn(() => {
      const sub: Record<string, any> = {};
      sub.select = vi.fn(() => sub);
      sub.single = vi.fn(() => Promise.resolve({ data: { id: "device-2" }, error: null }));
      return sub;
    });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "device_usage") return deviceChain;
      if (table === "daily_usage") return dailyUsageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5-20250929"],
              inputTokens: 2000,
              outputTokens: 800,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              totalTokens: 2800,
              costUSD: 3.0,
              modelBreakdown: [{ model: "claude-sonnet-4-5-20250929", cost_usd: 3.0 }],
            },
          },
        ],
        hash: "device-2-hash",
        source: "cli",
        device_id: "22222222-2222-4222-8222-222222222222",
        device_name: "home-desktop",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);

    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      "submit_usage_day_v2",
      expect.objectContaining({
        p_installation: expect.objectContaining({
          id: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );
  });

  it("rejects push without authentication", async () => {
    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{
          date: "2026-03-13",
          data: {
            date: "2026-03-13",
            costUSD: 1,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            models: ["gpt-5.6"],
          },
        }],
        source: "cli",
        device_id: "aaaaaaaa-0000-4000-8000-000000000001",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
