import { describe, it, expect, vi, beforeEach } from "vitest";

const leaderboardMocks = vi.hoisted(() => ({
  loadEntries: vi.fn(),
  loadRank: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getAuthIdentity: leaderboardMocks.getAuthIdentity,
}));

vi.mock("@/lib/data/leaderboard", () => ({
  LEADERBOARD_PERIODS: ["day", "week", "month", "all_time"],
  loadLeaderboardEntries: leaderboardMocks.loadEntries,
  loadLeaderboardRank: leaderboardMocks.loadRank,
}));

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: [] }),
};

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
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
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (value: Record<string, unknown>) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>;
    _setResolved?: (value: Record<string, unknown>) => void;
  } = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in", "is",
    "order", "limit",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(_resolved));
  chain.maybeSingle = vi.fn(() => Promise.resolve(_resolved));
  // Make chain thenable — `await chain` resolves to _resolved
  chain.then = (resolve, reject) => Promise.resolve(_resolved).then(resolve, reject);
  // Allow tests to change the resolution value
  chain._setResolved = (val: Record<string, unknown>) => { _resolved = val; };
  return chain;
}

import { NextRequest } from "next/server";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Leaderboard Ranking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSupabase.rpc.mockResolvedValue({ data: [] });
    mockServiceClient.from.mockReset();
    leaderboardMocks.loadEntries.mockResolvedValue([]);
    leaderboardMocks.loadRank.mockResolvedValue(null);
    leaderboardMocks.getAuthIdentity.mockResolvedValue(null);
  });

  it("returns users sorted by cost DESC with correct rank badges", async () => {
    const currentUserId = "user-3";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: currentUserId } },
    });
    leaderboardMocks.getAuthIdentity.mockResolvedValue({
      id: currentUserId,
      email: null,
    });

    const entries = [
      { user_id: "user-1", username: "topspender", total_cost: 100.0, region: "north_america" },
      { user_id: "user-2", username: "midspender", total_cost: 50.0, region: "europe" },
      { user_id: "user-3", username: "lowspender", total_cost: 25.0, region: "asia" },
      { user_id: "user-4", username: "casual", total_cost: 10.0, region: "north_america" },
    ];
    leaderboardMocks.loadEntries.mockResolvedValue(entries);

    const lbChain = chainBuilder({ data: entries, error: null });

    mockSupabase.from.mockImplementation(() => lbChain);
    mockServiceClient.from.mockImplementation(() =>
      chainBuilder({ data: [], error: null })
    );

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req);
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
    leaderboardMocks.loadEntries.mockResolvedValue(naEntries);

    const lbChain = chainBuilder({ data: naEntries, error: null });

    mockSupabase.from.mockImplementation(() => lbChain);
    mockServiceClient.from.mockImplementation(() =>
      chainBuilder({ data: [], error: null })
    );

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week&region=north_america");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entries).toHaveLength(2);
    expect(data.entries.every((entry: { region: string }) => entry.region === "north_america")).toBe(true);
    expect(leaderboardMocks.loadEntries).toHaveBeenCalledWith({
      period: "week",
      region: "north_america",
      cursor: null,
      limit: 50,
    });
  });

  it("filters by period: uses correct view", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const lbChain = chainBuilder({ data: [], error: null });
    mockSupabase.from.mockImplementation(() => lbChain);
    mockServiceClient.from.mockImplementation(() =>
      chainBuilder({ data: [], error: null })
    );

    const { GET } = await import("@/app/api/leaderboard/route");

    for (const period of ["day", "week", "month", "all_time"] as const) {
      leaderboardMocks.loadEntries.mockClear();
      const req = makeRequest(`http://localhost:3000/api/leaderboard?period=${period}`);
      await GET(req);

      expect(leaderboardMocks.loadEntries).toHaveBeenCalledWith({
        period,
        region: null,
        cursor: null,
        limit: 50,
      });
    }
  });

  it("rejects invalid period", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=invalid");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("computes user rank separately when user not in current page", async () => {
    const currentUserId = "user-far";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: currentUserId } },
    });
    leaderboardMocks.getAuthIdentity.mockResolvedValue({
      id: currentUserId,
      email: null,
    });

    // Main leaderboard does not include current user
    const topEntries = [
      { user_id: "user-1", username: "top1", total_cost: 200.0 },
      { user_id: "user-2", username: "top2", total_cost: 150.0 },
    ];
    leaderboardMocks.loadEntries.mockResolvedValue(topEntries);
    leaderboardMocks.loadRank.mockResolvedValue(11);

    mockSupabase.from.mockImplementation(() => chainBuilder({ data: [], error: null }));
    mockServiceClient.from.mockImplementation(() =>
      chainBuilder({ data: [], error: null })
    );

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user_rank).toBe(11);
    expect(leaderboardMocks.loadRank).toHaveBeenCalledWith(
      "week",
      currentUserId,
      null
    );
  });
});
