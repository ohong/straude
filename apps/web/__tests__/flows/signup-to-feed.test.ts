import { describe, it, expect, vi, beforeEach } from "vitest";

const leaderboardMocks = vi.hoisted(() => ({
  loadEntries: vi.fn(),
  loadRank: vi.fn(),
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
  auth: { getUser: vi.fn(), getClaims: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: [] }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

const mockServiceSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceSupabase),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
    mockSupabase.rpc.mockResolvedValue({ data: [] });
    mockSupabase.auth.getClaims.mockImplementation(async () => {
      const result = await mockSupabase.auth.getUser();
      const subject = result?.data?.user?.id;
      return {
        data: typeof subject === "string" ? { claims: { sub: subject } } : null,
        error: result?.error ?? null,
      };
    });
    leaderboardMocks.loadEntries.mockResolvedValue([]);
    leaderboardMocks.loadRank.mockResolvedValue(null);
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
