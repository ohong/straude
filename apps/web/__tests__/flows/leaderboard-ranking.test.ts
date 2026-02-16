import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Creates a chainable Supabase query mock that is also thenable.
 * Chaining methods (select, eq, order, limit, etc.) return the chain.
 * `await chain` resolves to the configured result.
 */
function chainBuilder(resolvedData: Record<string, unknown> = { data: [], error: null }) {
  let _resolved = resolvedData;
  const chain: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in",
    "order", "limit",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(_resolved));
  chain.maybeSingle = vi.fn(() => Promise.resolve(_resolved));
  // Make chain thenable — `await chain` resolves to _resolved
  chain.then = (resolve: any, reject: any) => Promise.resolve(_resolved).then(resolve, reject);
  // Allow tests to change the resolution value
  chain._setResolved = (val: Record<string, unknown>) => { _resolved = val; };
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
describe("Flow: Leaderboard Ranking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns users sorted by cost DESC with correct rank badges", async () => {
    const currentUserId = "user-3";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: currentUserId } },
    });

    const entries = [
      { user_id: "user-1", username: "topspender", total_cost: 100.0, region: "north_america" },
      { user_id: "user-2", username: "midspender", total_cost: 50.0, region: "europe" },
      { user_id: "user-3", username: "lowspender", total_cost: 25.0, region: "asia" },
      { user_id: "user-4", username: "casual", total_cost: 10.0, region: "north_america" },
    ];

    const lbChain = chainBuilder({ data: entries, error: null });

    mockSupabase.from.mockImplementation(() => lbChain);

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entries).toHaveLength(4);
    expect(data.entries[0].rank).toBe(1);
    expect(data.entries[0].username).toBe("topspender");
    expect(data.entries[1].rank).toBe(2);
    expect(data.entries[2].rank).toBe(3);
    expect(data.entries[3].rank).toBe(4);
    // Current user found inline
    expect(data.user_rank).toBe(3);
  });

  it("filters by region: only matching users shown", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const naEntries = [
      { user_id: "user-1", username: "topspender", total_cost: 100.0, region: "north_america" },
      { user_id: "user-4", username: "casual", total_cost: 10.0, region: "north_america" },
    ];

    const lbChain = chainBuilder({ data: naEntries, error: null });

    mockSupabase.from.mockImplementation(() => lbChain);

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week&region=north_america");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entries).toHaveLength(2);
    expect(data.entries.every((e: any) => e.region === "north_america")).toBe(true);
    expect(lbChain.eq).toHaveBeenCalledWith("region", "north_america");
  });

  it("filters by period: uses correct view", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const lbChain = chainBuilder({ data: [], error: null });
    mockSupabase.from.mockImplementation(() => lbChain);

    const { GET } = await import("@/app/api/leaderboard/route");

    for (const [period, view] of [
      ["day", "leaderboard_daily"],
      ["week", "leaderboard_weekly"],
      ["month", "leaderboard_monthly"],
      ["all_time", "leaderboard_all_time"],
    ] as const) {
      mockSupabase.from.mockClear();
      mockSupabase.from.mockImplementation(() => lbChain);

      const req = makeRequest(`http://localhost:3000/api/leaderboard?period=${period}`);
      await GET(req as any);

      expect(mockSupabase.from).toHaveBeenCalledWith(view);
    }
  });

  it("rejects invalid period", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=invalid");
    const res = await GET(req as any);

    expect(res.status).toBe(400);
  });

  it("computes user rank separately when user not in current page", async () => {
    const currentUserId = "user-far";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: currentUserId } },
    });

    // Main leaderboard does not include current user
    const topEntries = [
      { user_id: "user-1", username: "top1", total_cost: 200.0 },
      { user_id: "user-2", username: "top2", total_cost: 150.0 },
    ];

    // User entry lookup
    const userEntryResult = { data: { total_cost: 5.0 }, error: null };
    // Count of users above
    const countResult = { count: 10, data: null, error: null };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainBuilder({ data: topEntries, error: null });
      if (callCount === 2) {
        // head: true count query (not used directly for user lookup)
        return chainBuilder({ count: 0, data: null, error: null });
      }
      if (callCount === 3) {
        // user's entry
        const c = chainBuilder();
        c.maybeSingle = vi.fn(() => Promise.resolve(userEntryResult));
        return c;
      }
      // count above
      return chainBuilder(countResult);
    });

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user_rank).toBe(11);
  });
});
