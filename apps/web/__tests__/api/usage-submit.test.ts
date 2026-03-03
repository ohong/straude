import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliToken: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { POST, aggregateDeviceRows } from "@/app/api/usage/submit/route";
import { createClient } from "@/lib/supabase/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
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
    ...overrides,
  };
  (createServiceClient as any).mockReturnValue(chain);
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

function mockRequest(body: any, headers: Record<string, string> = {}) {
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
    // Each entry needs two .single() calls: usage + post
    svc.single
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
  });

  it("submits multiple days (batch)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    // 2 entries, each needing 2 .single() calls
    svc.single
      .mockResolvedValueOnce({ data: { id: "u1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "p1" }, error: null })
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

  it("rejects dates older than 7 days", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(daysAgo(10))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("outside the 7-day backfill window");
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

  it("uses upsert on conflict (user_id,date)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // Verify upsert was called with onConflict
    expect(svc.upsert).toHaveBeenCalled();
    const firstUpsertCall = svc.upsert.mock.calls[0];
    expect(firstUpsertCall[1]).toEqual({ onConflict: "user_id,date" });
  });

  it("auto-creates post for each usage entry", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // upsert called once for usage, insert called once for new post
    expect(svc.upsert).toHaveBeenCalledTimes(1);
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
    const svc = mockServiceClient();
    svc.single
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
        return deviceFromCallCount === 1 ? deviceUpsertChain : deviceFetchChain;
      }
      if (table === "daily_usage") return dailyChain;
      if (table === "posts") return postChain;
      return dailyChain;
    });

    (createServiceClient as any).mockReturnValue({ from: fromFn });

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
  });

  it("multi-device: backwards compat — no device_id uses legacy path", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    // Legacy path: upsert directly to daily_usage, device_usage never touched
    const fromCalls = svc.from.mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).not.toContain("device_usage");
    expect(svc.upsert).toHaveBeenCalled();
    const upsertCall = svc.upsert.mock.calls[0];
    expect(upsertCall[1]).toEqual({ onConflict: "user_id,date" });
  });

  it("accepts merged Claude + Codex usage in a single entry", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
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
