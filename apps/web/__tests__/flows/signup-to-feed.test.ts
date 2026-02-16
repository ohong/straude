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
function chainBuilder(terminal: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "lt",
    "gte",
    "lte",
    "in",
    "order",
    "limit",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain["single"] = vi.fn(() => Promise.resolve(terminal));
  chain["then"] = undefined; // prevent auto-await of the chain itself
  Object.assign(chain, state);
  return chain;
}

function jsonResponse(body: unknown, status = 200) {
  return { status, json: () => body };
}

function makeRequest(url: string, init?: RequestInit) {
  const parsedUrl = new URL(url, "http://localhost:3000");
  const req = new Request(parsedUrl, init);
  // Next.js route handlers receive NextRequest which has nextUrl
  (req as any).nextUrl = parsedUrl;
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Signup to Feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
  });

  it("new user lands on feed and sees empty results before following anyone", async () => {
    const userId = "user-new-1";

    // Step 1: Auth callback completed — user is now authenticated
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    // Step 2: Feed returns empty because user follows nobody
    const followsChain = chainBuilder();
    (followsChain.select as ReturnType<typeof vi.fn>).mockReturnValue(followsChain);
    (followsChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(followsChain);
    // Resolve the follows query with empty array (no follows)
    (followsChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "follows") return followsChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/feed/route");
    const req = makeRequest("http://localhost:3000/api/feed");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toEqual([]);
    expect(data.next_cursor).toBeUndefined();
  });

  it("profile completion sets username, country, and auto-derives region", async () => {
    const userId = "user-new-1";

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const updatedProfile = {
      id: userId,
      username: "alice_dev",
      country: "US",
      region: "north_america",
      is_public: true,
    };

    const updateChain = chainBuilder({ data: updatedProfile, error: null });
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") return updateChain;
      return chainBuilder();
    });

    const { PATCH } = await import("@/app/api/users/me/route");
    const req = makeRequest("http://localhost:3000/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice_dev", country: "US" }),
    });
    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);

    // Verify that the update was called with region auto-derived
    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({
      username: "alice_dev",
      country: "US",
      region: "north_america",
    });
  });

  it("user appears in leaderboard after profile completion", async () => {
    const userId = "user-new-1";

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const leaderboardEntries = [
      { user_id: userId, username: "alice_dev", total_cost: 12.5, region: "north_america" },
      { user_id: "user-2", username: "bob", total_cost: 8.0, region: "europe" },
    ];

    const lbChain = chainBuilder();
    (lbChain.select as ReturnType<typeof vi.fn>).mockReturnValue(lbChain);
    (lbChain.order as ReturnType<typeof vi.fn>).mockReturnValue(lbChain);
    (lbChain.limit as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: leaderboardEntries,
      error: null,
    });

    // User entry lookup for rank
    const userEntryChain = chainBuilder();
    (userEntryChain.select as ReturnType<typeof vi.fn>).mockReturnValue(userEntryChain);
    (userEntryChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(userEntryChain);
    (userEntryChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { total_cost: 12.5 },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "leaderboard_weekly") return lbChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/leaderboard/route");
    const req = makeRequest("http://localhost:3000/api/leaderboard?period=week");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].rank).toBe(1);
    expect(data.entries[0].user_id).toBe(userId);
    expect(data.entries[1].rank).toBe(2);
  });

  it("rejects invalid usernames during profile completion", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-new-1" } },
    });

    const { PATCH } = await import("@/app/api/users/me/route");
    const req = makeRequest("http://localhost:3000/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ab" }), // too short
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(400);
  });
});
