import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliToken: vi.fn(),
  verifyCliTokenWithRefresh: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { POST, aggregateDeviceRows } from "@/app/api/usage/submit/route";
import { createClient } from "@/lib/supabase/server";
import { verifyCliToken, verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

function makeEntry(dateStr: string, overrides: Record<string, any> = {}) {
  return {
    date: dateStr,
    data: {
      date: dateStr,
      models: ["claude-sonnet-4-5-20250929"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1500,
      costUSD: 0.05,
      ...overrides,
    },
  };
}

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]!;
}

function mockServiceClient(overrides: Record<string, any> = {}) {
  const chain: Record<string, any> = {
    from: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data: { id: "usage-1" },
      error: null,
    }),
    // These make the chain itself act as a resolved query result,
    // needed for calls that end with .eq() (e.g. device_usage fetch)
    data: [],
    error: null,
    count: 0,
    ...overrides,
  };
  (getServiceClient as any).mockReturnValue(chain);
  return chain;
}

function mockSupabaseAuth(userId: string | null) {
  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

const DEFAULT_DEVICE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const DEFAULT_DEVICE_NAME = "test-device";

function mockRequest(body: any, headers: Record<string, string> = {}) {
  // All requests must include device_id unless explicitly testing the rejection
  const withDevice = {
    device_id: DEFAULT_DEVICE_ID,
    device_name: DEFAULT_DEVICE_NAME,
    ...body,
  };
  return new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(withDevice),
  });
}

function mockRequestRaw(body: any, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://straude.com";
  (verifyCliToken as any).mockReturnValue(null);
  // Auto-derive verifyCliTokenWithRefresh from verifyCliToken so existing
  // tests can keep setting `verifyCliToken.mockReturnValue("cli-user-id")`.
  (verifyCliTokenWithRefresh as any).mockImplementation((header: string | null) => {
    const userId = (verifyCliToken as any)(header);
    return userId ? { userId, username: null, refreshedToken: null } : null;
  });
});

describe("POST /api/usage/submit", () => {
  it("rejects unauthenticated requests", async () => {
    mockSupabaseAuth(null);
    const svc = mockServiceClient();

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "web" })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("handles CLI JWT auth (Bearer token)", async () => {
    (verifyCliToken as any).mockReturnValue("cli-user-id");
    mockSupabaseAuth(null);
    const svc = mockServiceClient();
    // Each entry needs three .single() calls: device upsert + daily upsert + post
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest(
        { entries: [makeEntry(todayStr())], source: "cli" },
        { authorization: "Bearer some-token" }
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(verifyCliToken).toHaveBeenCalledWith("Bearer some-token");
    expect(json.results).toHaveLength(1);
  });

  it("handles Supabase session auth (cookie/web)", async () => {
    mockSupabaseAuth("web-user-id");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "web" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
  });

  it("submits a single day entry successfully", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].date).toBe(todayStr());
    expect(json.results[0].usage_id).toBe("usage-1");
    expect(json.results[0].post_id).toBe("post-1");
    expect(json.results[0].post_url).toBe("https://straude.com/post/post-1");
    expect(svc.rpc).toHaveBeenCalledWith("recalculate_user_level", { p_user_id: "user-1" });
  });

  it("submits multiple days (batch)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    // 2 entries, each needing 3 .single() calls (device + daily + post)
    svc.single
      .mockResolvedValueOnce({ data: { id: "d1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "u1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "p1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "d2" }, error: null })
      .mockResolvedValueOnce({ data: { id: "u2" }, error: null })
      .mockResolvedValueOnce({ data: { id: "p2" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr()), makeEntry(daysAgo(1))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(2);
  });

  it("rejects dates older than 30 days", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(daysAgo(35))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("outside the 30-day backfill window");
  });

  it("accepts dates up to 30 days ago", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(daysAgo(29))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
  });

  it("rejects negative cost", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), { costUSD: -5 })],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Negative cost");
  });

  it("rejects negative tokens", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), { inputTokens: -100 })],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Negative input tokens");
  });

  it("uses upsert on conflict for device_usage and daily_usage", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // Verify upsert was called for both device_usage and daily_usage
    expect(svc.upsert).toHaveBeenCalledTimes(2);
    expect(svc.upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id,date,device_id" });
    expect(svc.upsert.mock.calls[1][1]).toEqual({ onConflict: "user_id,date" });
  });

  it("auto-creates post for each usage entry", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // upsert called twice (device_usage + daily_usage), insert once for new post
    expect(svc.upsert).toHaveBeenCalledTimes(2);
    expect(svc.insert).toHaveBeenCalledTimes(1);
    const postInsertCall = svc.insert.mock.calls[0];
    expect(postInsertCall[0]).toMatchObject({
      user_id: "user-1",
      daily_usage_id: "usage-1",
    });
  });

  it("rejects invalid JSON body", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const req = new Request("http://localhost/api/usage/submit", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON");
  });

  it("rejects empty entries array", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const res = await POST(
      mockRequest({ entries: [], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("No entries provided");
  });

  it("rejects invalid source", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "invalid" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid source");
  });

  // -------------------------------------------------------------------------
  // Codex / model_breakdown tests
  // -------------------------------------------------------------------------

  it("stores model_breakdown in upsert when provided", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const breakdown = [
      { model: "claude-opus-4-20250505", cost_usd: 10.0 },
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ];

    const res = await POST(
      mockRequest({
        entries: [
          makeEntry(todayStr(), {
            models: ["claude-opus-4-20250505", "gpt-5-codex"],
            costUSD: 13.0,
            modelBreakdown: breakdown,
          }),
        ],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    const upsertCall = svc.upsert.mock.calls[0];
    expect(upsertCall[0].model_breakdown).toEqual(breakdown);
  });

  it("stores null model_breakdown when not provided (backward compat)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr())],
        source: "cli",
      })
    );

    expect(res.status).toBe(200);
    const upsertCall = svc.upsert.mock.calls[0];
    expect(upsertCall[0].model_breakdown).toBeNull();
  });

  it("accepts Codex-only usage (no Claude models)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [
          makeEntry(todayStr(), {
            models: ["gpt-5-codex"],
            costUSD: 3.0,
            inputTokens: 2000,
            outputTokens: 800,
            totalTokens: 2800,
            modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 3.0 }],
          }),
        ],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    const upsertCall = svc.upsert.mock.calls[0];
    expect(upsertCall[0].models).toEqual(["gpt-5-codex"]);
    expect(upsertCall[0].cost_usd).toBe(3.0);
    expect(upsertCall[0].model_breakdown).toEqual([
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ]);
  });

  it("auto-title keeps full GPT Codex model version", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const deviceRow = {
      cost_usd: 3.2,
      input_tokens: 2100,
      output_tokens: 900,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 3000,
      models: ["gpt-5.3-codex"],
      model_breakdown: [{ model: "gpt-5.3-codex", cost_usd: 3.2 }],
    };
    const svc = mockServiceClient({ data: [deviceRow] });
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [
          makeEntry(todayStr(), {
            models: ["gpt-5.3-codex"],
            costUSD: 3.2,
            inputTokens: 2100,
            outputTokens: 900,
            totalTokens: 3000,
            modelBreakdown: [{ model: "gpt-5.3-codex", cost_usd: 3.2 }],
          }),
        ],
        source: "cli",
      })
    );

    expect(res.status).toBe(200);
    const postInsertCall = svc.insert.mock.calls[0];
    expect(postInsertCall[0].title).toContain("GPT-5.3-Codex");
  });

  // -------------------------------------------------------------------------
  // Multi-device tests
  // -------------------------------------------------------------------------

  it("multi-device: device_id triggers device_usage upsert path", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    const deviceRows = [
      {
        cost_usd: 0.05,
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
        total_tokens: 1500,
        models: ["claude-sonnet-4-5-20250929"],
        model_breakdown: null,
      },
    ];

    // Build a per-table mock that distinguishes device_usage from daily_usage
    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const deviceUpsertChain: Record<string, any> = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "dev-1" }, error: null }),
    };
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: deviceRows, error: null }),
      })),
    };
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "usage-1" }, error: null }),
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceUpsertChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });

    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr())],
        source: "cli",
        device_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        device_name: "work-laptop",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    // Verify device_usage table was targeted
    expect(fromFn).toHaveBeenCalledWith("device_usage");
    // Verify device_usage upsert was called with device_id conflict
    expect(deviceUpsertChain.upsert).toHaveBeenCalled();
    expect(deviceUpsertChain.upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id,date,device_id" });
    // Verify daily_usage was upserted with aggregated values
    expect(dailyChain.upsert).toHaveBeenCalled();
    expect(dailyChain.upsert.mock.calls[0][0].cost_usd).toBe(0.05);
    expect(dailyChain.upsert.mock.calls[0][0].session_count).toBe(1);
    // Verify new response fields
    expect(json.results[0].previous_cost).toBeUndefined();
    expect(json.results[0].daily_total).toBe(0.05);
    expect(json.results[0].device_count).toBe(1);
  });

  it("multi-device: re-push returns previous_cost and aggregated daily_total", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    // Two device rows: existing device A ($5) + current device B ($3) = $8 total
    const allDeviceRows = [
      {
        cost_usd: 5.0,
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
        total_tokens: 1500,
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

    // Guard: no existing device_usage for device B
    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const deviceUpsertChain: Record<string, any> = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "dev-2" }, error: null }),
    };
    // Fetch returns BOTH device rows (device A + device B)
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: allDeviceRows, error: null }),
      })),
    };
    // daily_usage already exists with $5 (from device A's earlier push)
    let dailySelectCount = 0;
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        dailySelectCount++;
        // First maybeSingle: existing daily_usage check
        if (dailySelectCount === 1) {
          return Promise.resolve({ data: { id: "usage-1", cost_usd: 5.0, models: ["claude-opus-4-20250505"] }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      single: vi.fn().mockResolvedValue({ data: { id: "usage-1" }, error: null }),
    };
    const deviceCountChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }),
      })),
      count: 1,
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "post-1", title: "Mar 31" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceCountChain;
        if (deviceFromCallCount === 3) return deviceUpsertChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });

    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const DEVICE_B = "11111111-2222-3333-4444-555555555555";
    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), {
          models: ["claude-sonnet-4-5-20250929"],
          costUSD: 3.0,
          inputTokens: 2000,
          outputTokens: 800,
          totalTokens: 2800,
        })],
        source: "cli",
        device_id: DEVICE_B,
        device_name: "home-laptop",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].action).toBe("updated");
    // Previous daily total was $5 from device A
    expect(json.results[0].previous_cost).toBe(5.0);
    // New daily total is $8 (device A $5 + device B $3)
    expect(json.results[0].daily_total).toBe(8.0);
    // Two devices contributed
    expect(json.results[0].device_count).toBe(2);
  });

  it("keeps the lower-value overwrite guard for old collectors", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    const existingDeviceRow = {
      cost_usd: 100,
      input_tokens: 100000,
      output_tokens: 1000,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 101000,
      models: ["gpt-5-codex"],
      model_breakdown: [{ model: "gpt-5-codex", cost_usd: 100 }],
    };

    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cost_usd: 100, models: ["gpt-5-codex"] },
        error: null,
      }),
    };
    const deviceCountChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }),
      })),
    };
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: [existingDeviceRow], error: null }),
      })),
    };
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "usage-1", cost_usd: 100, models: ["gpt-5-codex"] }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "usage-1" }, error: null }),
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "post-1", title: "Apr 24" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceCountChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });
    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), {
          models: ["gpt-5-codex"],
          costUSD: 10,
          inputTokens: 10000,
          outputTokens: 100,
          totalTokens: 10100,
        })],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results[0].daily_total).toBe(100);
    expect(dailyChain.upsert.mock.calls[0][0].cost_usd).toBe(100);
  });

  it("allows native Codex repair submissions to lower inflated device and daily rows", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    const correctedDeviceRow = {
      cost_usd: 10,
      input_tokens: 10000,
      output_tokens: 100,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 10100,
      models: ["gpt-5-codex"],
      model_breakdown: [{ model: "gpt-5-codex", cost_usd: 10 }],
    };

    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cost_usd: 100, models: ["gpt-5-codex"] },
        error: null,
      }),
    };
    const deviceUpsertChain: Record<string, any> = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "dev-1" }, error: null }),
    };
    const deviceCountChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }),
      })),
    };
    const deviceDeleteChain: Record<string, any> = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: [correctedDeviceRow], error: null }),
      })),
    };
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "usage-1", cost_usd: 100, models: ["gpt-5-codex"] }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "usage-1" }, error: null }),
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "post-1", title: "Apr 24 — GPT-5-Codex, $100.00" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceCountChain;
        if (deviceFromCallCount === 3) return deviceUpsertChain;
        if (deviceFromCallCount === 4) return deviceDeleteChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });
    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), {
          models: ["gpt-5-codex"],
          costUSD: 10,
          inputTokens: 10000,
          outputTokens: 100,
          totalTokens: 10100,
          modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 10 }],
        })],
        source: "cli",
        collector: { codex: "straude-codex-native-v1" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deviceUpsertChain.upsert).toHaveBeenCalled();
    expect(deviceUpsertChain.upsert.mock.calls[0][0].collector_meta).toEqual({ codex: "straude-codex-native-v1" });
    expect(deviceDeleteChain.delete).toHaveBeenCalled();
    expect(dailyChain.upsert.mock.calls[0][0].cost_usd).toBe(10);
    expect(dailyChain.upsert.mock.calls[0][0].collector_meta).toEqual({ codex: "straude-codex-native-v1" });
    expect(json.results[0].previous_cost).toBe(100);
    expect(json.results[0].daily_total).toBe(10);
  });

  it("does not drop mixed legacy usage on a Codex-only repair", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    const legacyDeviceRow = {
      cost_usd: 100,
      input_tokens: 100000,
      output_tokens: 1000,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 101000,
      models: ["claude-opus-4-20250505", "gpt-5-codex"],
      model_breakdown: [
        { model: "claude-opus-4-20250505", cost_usd: 90 },
        { model: "gpt-5-codex", cost_usd: 10 },
      ],
      raw_hash: "legacy-hash",
    };
    const correctedDeviceRow = {
      cost_usd: 10,
      input_tokens: 10000,
      output_tokens: 100,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 10100,
      models: ["gpt-5-codex"],
      model_breakdown: [{ model: "gpt-5-codex", cost_usd: 10 }],
    };

    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const deviceCountChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }),
      })),
    };
    const deviceUpsertChain: Record<string, any> = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "dev-1" }, error: null }),
    };
    const deviceInsertChain: Record<string, any> = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const deviceDeleteChain: Record<string, any> = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [legacyDeviceRow, correctedDeviceRow],
          error: null,
        }),
      })),
    };
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "usage-1",
          cost_usd: 100,
          models: ["claude-opus-4-20250505", "gpt-5-codex"],
        },
        error: null,
      }),
      single: vi.fn()
        .mockResolvedValueOnce({ data: legacyDeviceRow, error: null })
        .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null }),
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "post-1", title: "Apr 24" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceCountChain;
        if (deviceFromCallCount === 3) return deviceUpsertChain;
        if (deviceFromCallCount === 4) return deviceInsertChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });
    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), {
          models: ["gpt-5-codex"],
          costUSD: 10,
          inputTokens: 10000,
          outputTokens: 100,
          totalTokens: 10100,
          modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 10 }],
        })],
        source: "cli",
        collector: { codex: "straude-codex-native-v1" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deviceDeleteChain.delete).not.toHaveBeenCalled();
    expect(deviceInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        device_id: "00000000-0000-0000-0000-000000000000",
        cost_usd: 100,
      })
    );
    expect(dailyChain.upsert.mock.calls[0][0].cost_usd).toBe(110);
    expect(json.results[0].daily_total).toBe(110);
  });

  it("does not overwrite a mixed same-device row with a Codex-only repair", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");

    const mixedDeviceRow = {
      cost_usd: 100,
      input_tokens: 100000,
      output_tokens: 1000,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 101000,
      models: ["claude-opus-4-20250505", "gpt-5-codex"],
      model_breakdown: [
        { model: "claude-opus-4-20250505", cost_usd: 90 },
        { model: "gpt-5-codex", cost_usd: 10 },
      ],
    };

    const deviceGuardChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cost_usd: 100, models: mixedDeviceRow.models },
        error: null,
      }),
    };
    const deviceCountChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }),
      })),
    };
    const deviceUpsertChain: Record<string, any> = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "dev-1" }, error: null }),
    };
    const deviceDeleteChain: Record<string, any> = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const deviceFetchChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: [mixedDeviceRow], error: null }),
      })),
    };
    const dailyChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "usage-1",
          cost_usd: 100,
          models: mixedDeviceRow.models,
        },
        error: null,
      }),
      single: vi.fn().mockResolvedValue({ data: { id: "usage-1" }, error: null }),
    };
    const postChain: Record<string, any> = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "post-1", title: "Apr 24" }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
    };

    let deviceFromCallCount = 0;
    const fromFn = vi.fn((table: string) => {
      if (table === "device_usage") {
        deviceFromCallCount++;
        if (deviceFromCallCount === 1) return deviceGuardChain;
        if (deviceFromCallCount === 2) return deviceCountChain;
        return deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });
    (getServiceClient as any).mockReturnValue({ from: fromFn, rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), {
          models: ["gpt-5-codex"],
          costUSD: 10,
          inputTokens: 10000,
          outputTokens: 100,
          totalTokens: 10100,
          modelBreakdown: [{ model: "gpt-5-codex", cost_usd: 10 }],
        })],
        source: "cli",
        collector: { codex: "straude-codex-native-v1" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deviceUpsertChain.upsert).not.toHaveBeenCalled();
    expect(deviceDeleteChain.delete).not.toHaveBeenCalled();
    expect(dailyChain.upsert.mock.calls[0][0].cost_usd).toBe(100);
    expect(json.results[0].daily_total).toBe(100);
  });

  it("rejects requests without device_id", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequestRaw({ entries: [makeEntry(todayStr())], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("device_id is required");
  });

  it("accepts merged Claude + Codex usage in a single entry", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "dev-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [
          makeEntry(todayStr(), {
            models: ["claude-opus-4-20250505", "gpt-5-codex"],
            costUSD: 13.0,
            inputTokens: 3000,
            outputTokens: 1300,
            totalTokens: 4300,
            modelBreakdown: [
              { model: "claude-opus-4-20250505", cost_usd: 10.0 },
              { model: "gpt-5-codex", cost_usd: 3.0 },
            ],
          }),
        ],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    const upsertCall = svc.upsert.mock.calls[0];
    expect(upsertCall[0].cost_usd).toBe(13.0);
    expect(upsertCall[0].input_tokens).toBe(3000);
    expect(upsertCall[0].models).toEqual(["claude-opus-4-20250505", "gpt-5-codex"]);
    expect(upsertCall[0].model_breakdown).toEqual([
      { model: "claude-opus-4-20250505", cost_usd: 10.0 },
      { model: "gpt-5-codex", cost_usd: 3.0 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// aggregateDeviceRows
// ---------------------------------------------------------------------------

describe("aggregateDeviceRows", () => {
  it("sums numeric fields across two device rows", () => {
    const rows = [
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

    const agg = aggregateDeviceRows(rows);

    expect(agg.cost_usd).toBe(8.0);
    expect(agg.input_tokens).toBe(3000);
    expect(agg.output_tokens).toBe(1300);
    expect(agg.cache_creation_tokens).toBe(100);
    expect(agg.cache_read_tokens).toBe(50);
    expect(agg.total_tokens).toBe(4450);
    expect(agg.session_count).toBe(2);
  });

  it("deduplicates models across devices", () => {
    const rows = [
      {
        cost_usd: 5.0,
        input_tokens: 1000, output_tokens: 500,
        cache_creation_tokens: 0, cache_read_tokens: 0,
        total_tokens: 1500,
        models: ["claude-opus-4-20250505"],
        model_breakdown: null,
      },
      {
        cost_usd: 3.0,
        input_tokens: 2000, output_tokens: 800,
        cache_creation_tokens: 0, cache_read_tokens: 0,
        total_tokens: 2800,
        models: ["claude-opus-4-20250505"],
        model_breakdown: null,
      },
    ];

    const agg = aggregateDeviceRows(rows);
    expect(agg.models).toEqual(["claude-opus-4-20250505"]);
  });

  it("merges model_breakdown by summing cost per model name", () => {
    const rows = [
      {
        cost_usd: 5.0,
        input_tokens: 1000, output_tokens: 500,
        cache_creation_tokens: 0, cache_read_tokens: 0,
        total_tokens: 1500,
        models: ["claude-opus-4-20250505"],
        model_breakdown: [{ model: "claude-opus-4-20250505", cost_usd: 5.0 }],
      },
      {
        cost_usd: 7.0,
        input_tokens: 2000, output_tokens: 800,
        cache_creation_tokens: 0, cache_read_tokens: 0,
        total_tokens: 2800,
        models: ["claude-opus-4-20250505"],
        model_breakdown: [{ model: "claude-opus-4-20250505", cost_usd: 7.0 }],
      },
    ];

    const agg = aggregateDeviceRows(rows);
    expect(agg.model_breakdown).toEqual([
      { model: "claude-opus-4-20250505", cost_usd: 12.0 },
    ]);
  });

  it("session_count reflects number of device rows", () => {
    const rows = [
      { cost_usd: 1, input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 0, models: [], model_breakdown: null },
      { cost_usd: 2, input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 0, models: [], model_breakdown: null },
      { cost_usd: 3, input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 0, models: [], model_breakdown: null },
    ];

    const agg = aggregateDeviceRows(rows);
    expect(agg.session_count).toBe(3);
    expect(agg.cost_usd).toBe(6);
  });

  it("returns null model_breakdown when no devices have breakdowns", () => {
    const rows = [
      { cost_usd: 1, input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 0, models: [], model_breakdown: null },
    ];

    const agg = aggregateDeviceRows(rows);
    expect(agg.model_breakdown).toBeNull();
  });
});
