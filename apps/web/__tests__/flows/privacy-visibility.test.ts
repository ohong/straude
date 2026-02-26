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

const PUBLIC_USER = {
  id: "user-pub",
  username: "publicdev",
  is_public: true,
  region: "north_america",
  country: "US",
};

const PRIVATE_USER = {
  id: "user-priv",
  username: "privatedev",
  is_public: false,
  region: "europe",
  country: "DE",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Privacy and Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return array for calculate_streaks_batch (leaderboard), number for calculate_user_streak (profile)
    mockSupabase.rpc.mockImplementation((_fn: string) => {
      if (_fn === "calculate_streaks_batch") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: 0 });
    });
  });

  it("public user appears in leaderboard", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const entries = [
      { user_id: PUBLIC_USER.id, username: PUBLIC_USER.username, total_cost: 50.0, region: "north_america" },
    ];

    const lbChain = chainBuilder();
    (lbChain.select as ReturnType<typeof vi.fn>).mockReturnValue(lbChain);
    (lbChain.order as ReturnType<typeof vi.fn>).mockReturnValue(lbChain);
    (lbChain.limit as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: entries,
      error: null,
    });

    mockSupabase.from.mockImplementation(() => lbChain);

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].user_id).toBe(PUBLIC_USER.id);
  });

  it("user profile shows is_public status and rank info for public user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const profileChain = chainBuilder({ data: PUBLIC_USER, error: null });

    const countChain = chainBuilder();
    (countChain.select as ReturnType<typeof vi.fn>).mockReturnValue(countChain);
    (countChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

    const costChain = chainBuilder();
    (costChain.select as ReturnType<typeof vi.fn>).mockReturnValue(costChain);
    (costChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ cost_usd: 50.0 }],
    });

    const weeklyChain = chainBuilder();
    (weeklyChain.select as ReturnType<typeof vi.fn>).mockReturnValue(weeklyChain);
    (weeklyChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(weeklyChain);
    (weeklyChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { total_cost: 50.0 },
    });

    const rankChain = chainBuilder();
    (rankChain.select as ReturnType<typeof vi.fn>).mockReturnValue(rankChain);
    (rankChain.gt as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    const regionRankChain = chainBuilder();
    (regionRankChain.select as ReturnType<typeof vi.fn>).mockReturnValue(regionRankChain);
    (regionRankChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(regionRankChain);
    (regionRankChain.gt as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "users") return profileChain;
      if (table === "follows") return countChain;
      if (table === "posts") return countChain;
      if (table === "daily_usage") return costChain;
      if (table === "leaderboard_weekly") {
        if (callCount <= 7) return weeklyChain;
        if (callCount <= 8) return rankChain;
        return regionRankChain;
      }
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/users/[username]/route");
    const req = makeRequest("http://localhost:3000/api/users/publicdev");
    const res = await GET(req as any, USERNAME_CTX("publicdev"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.is_public).toBe(true);
    // Public user should have rank info
    expect(data.global_rank).toBeDefined();
  });

  it("private user profile does not show rank info", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const profileChain = chainBuilder({ data: PRIVATE_USER, error: null });

    const countChain = chainBuilder();
    (countChain.select as ReturnType<typeof vi.fn>).mockReturnValue(countChain);
    (countChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const costChain = chainBuilder();
    (costChain.select as ReturnType<typeof vi.fn>).mockReturnValue(costChain);
    (costChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") return profileChain;
      if (table === "follows") return countChain;
      if (table === "posts") return countChain;
      if (table === "daily_usage") return costChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/users/[username]/route");
    const req = makeRequest("http://localhost:3000/api/users/privatedev");
    const res = await GET(req as any, USERNAME_CTX("privatedev"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.is_public).toBe(false);
    // Private user — the code skips rank lookup when !is_public
    expect(data.global_rank).toBeUndefined();
    expect(data.regional_rank).toBeUndefined();
  });

  it("user can toggle privacy by setting is_public to false", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: PUBLIC_USER.id } },
    });

    const updatedProfile = { ...PUBLIC_USER, is_public: false };
    const updateChain = chainBuilder({ data: updatedProfile, error: null });
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation(() => updateChain);

    const { PATCH } = await import("@/app/api/users/me/route");
    const req = makeRequest("http://localhost:3000/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: false }),
    });
    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.is_public).toBe(false);

    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.is_public).toBe(false);
  });

  it("follower can still access private user's profile page", async () => {
    const followerId = "user-follower";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: followerId } },
    });

    const profileChain = chainBuilder({ data: PRIVATE_USER, error: null });

    const countChain = chainBuilder();
    (countChain.select as ReturnType<typeof vi.fn>).mockReturnValue(countChain);
    (countChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const costChain = chainBuilder();
    (costChain.select as ReturnType<typeof vi.fn>).mockReturnValue(costChain);
    (costChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    // is_following check
    const followCheckChain = chainBuilder();
    (followCheckChain.select as ReturnType<typeof vi.fn>).mockReturnValue(followCheckChain);
    (followCheckChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(followCheckChain);
    (followCheckChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "follow-1" },
    });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "users") return profileChain;
      if (table === "follows") {
        // followers count, following count, is_following check
        if (callCount >= 6) return followCheckChain;
        return countChain;
      }
      if (table === "posts") return countChain;
      if (table === "daily_usage") return costChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/users/[username]/route");
    const req = makeRequest("http://localhost:3000/api/users/privatedev");
    const res = await GET(req as any, USERNAME_CTX("privatedev"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.username).toBe("privatedev");
    expect(data.is_following).toBe(true);
  });

  it("feed only shows posts from followed users (privacy via follows)", async () => {
    const viewerId = "user-viewer";
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: viewerId } },
    });

    // Viewer follows nobody
    const followsChain = chainBuilder();
    (followsChain.select as ReturnType<typeof vi.fn>).mockReturnValue(followsChain);
    (followsChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "follows") return followsChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/feed/route");
    const req = makeRequest("http://localhost:3000/api/feed");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    // No follows = no posts in feed (even if private user has posts)
    expect(data.posts).toEqual([]);
  });

  it("unauthenticated user can access global feed", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    // Global feed is public — support the .eq("user.is_public", true) chain
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "posts") {
        const c = chainBuilder();
        c.eq = vi.fn().mockReturnValue(c);
        c.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        return c;
      }
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/feed/route");
    const req = makeRequest("http://localhost:3000/api/feed");
    const res = await GET(req as any);

    expect(res.status).toBe(200);
  });
});
