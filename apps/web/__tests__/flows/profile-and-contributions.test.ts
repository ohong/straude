import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chainBuilder(resolved: Record<string, unknown> = {}) {
  const chain: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in",
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

const USERNAME_CTX = (u: string) => ({ params: Promise.resolve({ username: u }) });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Profile and Contributions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets profile via PATCH /api/users/me", async () => {
    const userId = "user-profile-1";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const profileData = {
      id: userId,
      username: "streaker",
      display_name: "Streak Runner",
      bio: "Shipping every day",
      country: "JP",
      region: "asia",
      is_public: true,
    };

    const updateChain = chainBuilder({ data: profileData, error: null });
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation(() => updateChain);

    const { PATCH } = await import("@/app/api/users/me/route");
    const req = makeRequest("http://localhost:3000/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "streaker",
        display_name: "Streak Runner",
        bio: "Shipping every day",
        country: "JP",
      }),
    });
    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);

    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.region).toBe("asia");
  });

  it("GET /api/users/[username] returns full profile with stats", async () => {
    const userId = "user-profile-1";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-1" } },
    });

    const profile = {
      id: userId,
      username: "streaker",
      display_name: "Streak Runner",
      bio: "Shipping every day",
      country: "JP",
      region: "asia",
      is_public: true,
    };

    // Profile lookup
    const profileChain = chainBuilder({ data: profile, error: null });

    // Follower/following/posts counts
    const followerCount = chainBuilder();
    (followerCount.select as ReturnType<typeof vi.fn>).mockReturnValue(followerCount);
    (followerCount.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 42 });

    const followingCount = chainBuilder();
    (followingCount.select as ReturnType<typeof vi.fn>).mockReturnValue(followingCount);
    (followingCount.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 15 });

    const postsCount = chainBuilder();
    (postsCount.select as ReturnType<typeof vi.fn>).mockReturnValue(postsCount);
    (postsCount.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 30 });

    // Total cost
    const costChain = chainBuilder();
    (costChain.select as ReturnType<typeof vi.fn>).mockReturnValue(costChain);
    (costChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ cost_usd: 5.0 }, { cost_usd: 3.0 }, { cost_usd: 2.0 }],
    });

    // Leaderboard rank
    const weeklyChain = chainBuilder();
    (weeklyChain.select as ReturnType<typeof vi.fn>).mockReturnValue(weeklyChain);
    (weeklyChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(weeklyChain);
    (weeklyChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { total_cost: 10.0 },
    });

    const rankCountChain = chainBuilder();
    (rankCountChain.select as ReturnType<typeof vi.fn>).mockReturnValue(rankCountChain);
    (rankCountChain.gt as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 4 });

    const regionRankChain = chainBuilder();
    (regionRankChain.select as ReturnType<typeof vi.fn>).mockReturnValue(regionRankChain);
    (regionRankChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(regionRankChain);
    (regionRankChain.gt as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    // Is following check
    const isFollowingChain = chainBuilder();
    (isFollowingChain.select as ReturnType<typeof vi.fn>).mockReturnValue(isFollowingChain);
    (isFollowingChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(isFollowingChain);
    (isFollowingChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });

    // Streak
    mockSupabase.rpc.mockResolvedValue({ data: 5 });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "users") return profileChain;
      if (table === "follows") {
        // First follows call = followers count, second = following count, third = is_following
        if (callCount <= 3) return followerCount;
        if (callCount <= 4) return followingCount;
        return isFollowingChain;
      }
      if (table === "posts") return postsCount;
      if (table === "daily_usage") return costChain;
      if (table === "leaderboard_weekly") {
        if (callCount <= 7) return weeklyChain;
        if (callCount <= 8) return rankCountChain;
        return regionRankChain;
      }
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/users/[username]/route");
    const req = makeRequest("http://localhost:3000/api/users/streaker");
    const res = await GET(req as any, USERNAME_CTX("streaker"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.username).toBe("streaker");
    expect(data.streak).toBe(5);
    expect(data.is_following).toBe(false);
  });

  it("GET /api/users/[username]/contributions returns graph data with streak", async () => {
    const userId = "user-profile-1";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    // Profile lookup
    const profileChain = chainBuilder({ data: { id: userId, is_public: true }, error: null });

    // 5 consecutive days of usage
    const today = new Date();
    const dates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (4 - i));
      return d.toISOString().split("T")[0]!;
    });

    const usageData = dates.map((date) => ({
      date,
      cost_usd: 2.5,
    }));

    const usageChain = chainBuilder();
    (usageChain.select as ReturnType<typeof vi.fn>).mockReturnValue(usageChain);
    (usageChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(usageChain);
    (usageChain.gte as ReturnType<typeof vi.fn>).mockReturnValue(usageChain);
    (usageChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: usageData,
    });

    // Posts linked to usage
    const postsChain = chainBuilder();
    (postsChain.select as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: dates.map((date) => ({
        daily_usage_id: `usage-${date}`,
        daily_usage: { date },
      })),
    });

    // Streak
    mockSupabase.rpc.mockResolvedValue({ data: 5 });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") return profileChain;
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postsChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/users/[username]/contributions/route");
    const req = makeRequest("http://localhost:3000/api/users/streaker/contributions");
    const res = await GET(req as any, USERNAME_CTX("streaker"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.streak).toBe(5);
    expect(data.data).toHaveLength(5);
    expect(data.data.every((d: any) => d.cost_usd === 2.5)).toBe(true);
    expect(data.data.every((d: any) => d.has_post === true)).toBe(true);
  });

  it("returns 404 for nonexistent user profile", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const notFoundChain = chainBuilder({ data: null, error: { message: "not found" } });

    mockSupabase.from.mockImplementation(() => notFoundChain);

    const { GET } = await import("@/app/api/users/[username]/route");
    const req = makeRequest("http://localhost:3000/api/users/nonexistent");
    const res = await GET(req as any, USERNAME_CTX("nonexistent"));

    expect(res.status).toBe(404);
  });
});
