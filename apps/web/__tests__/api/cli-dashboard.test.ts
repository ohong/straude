import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockServiceClient: Record<string, any> = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliTokenWithRefresh: vi.fn(() => ({
    userId: "user-123",
    username: "alice",
    refreshedToken: null,
  })),
}));

import { GET } from "@/app/api/cli/dashboard/route";

function chain(overrides: Record<string, any> = {}) {
  const query: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return query;
}

describe("GET /api/cli/dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    vi.clearAllMocks();
    mockServiceClient.rpc.mockResolvedValue({ data: 6, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates model breakdown from the same last-7-days window as the scorecard", async () => {
    const profile = chain({
      single: vi.fn().mockResolvedValue({
        data: { username: "alice", streak_freezes: 0 },
        error: null,
      }),
    });
    const level = chain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { level: 6 }, error: null }),
    });
    const daily = chain({
      order: vi.fn().mockResolvedValue({
        data: [
          { date: "2026-06-28", cost_usd: 30 },
          { date: "2026-07-04", cost_usd: 15 },
        ],
      }),
    });
    const lifetimeTokens = chain({
      eq: vi.fn().mockResolvedValue({
        data: [{ output_tokens: 12_000_000 }, { output_tokens: 3_000_000 }],
      }),
    });
    const weeklyModelBreakdown = chain({
      not: vi.fn().mockResolvedValue({
        data: [
          {
            model_breakdown: [
              { model: "claude-fable-5", cost_usd: 30 },
              { model: "claude-opus-4-20250505", cost_usd: 10 },
            ],
          },
          {
            model_breakdown: [
              { model: "claude-fable-5", cost_usd: 5 },
            ],
          },
        ],
      }),
    });
    const leaderboard = chain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockServiceClient.from
      .mockReturnValueOnce(profile)
      .mockReturnValueOnce(level)
      .mockReturnValueOnce(daily)
      .mockReturnValueOnce(lifetimeTokens)
      .mockReturnValueOnce(weeklyModelBreakdown)
      .mockReturnValueOnce(leaderboard);

    const response = await GET(
      new Request("http://localhost/api/cli/dashboard", {
        headers: { authorization: "Bearer token" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(weeklyModelBreakdown.gte).toHaveBeenCalledWith("date", "2026-06-28");
    expect(json.model_breakdown).toEqual([
      { model: "claude-fable-5", cost_usd: 35 },
      { model: "claude-opus-4-20250505", cost_usd: 10 },
    ]);
  });
});
