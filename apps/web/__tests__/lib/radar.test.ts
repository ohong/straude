import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), live: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ from: mocks.from })),
}));
vi.mock("@/lib/radar-live", () => ({ computeLiveRadarScores: mocks.live }));

import { computeRadarScores } from "@/lib/radar";

const scores = { output: 91, intensity: 72, consistency: 63, toolkit: 54, community: 45 };

describe("computeRadarScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.live.mockResolvedValue(scores);
  });

  it("uses a fresh service-only snapshot without global aggregation", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...scores, refreshed_at: new Date().toISOString() }, error: null });
    await expect(computeRadarScores("user-1")).resolves.toEqual(scores);
    expect(mocks.from).toHaveBeenCalledWith("profile_stats_snapshots");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.live).not.toHaveBeenCalled();
  });

  it.each([
    ["missing row", null, null],
    ["missing migration", null, { message: "relation missing" }],
    ["stopped cron", { ...scores, refreshed_at: new Date(Date.now() - 21 * 60 * 1000).toISOString() }, null],
    ["invalid refresh time", { ...scores, refreshed_at: "invalid" }, null],
  ])("uses live scores after a %s", async (_label, data, error) => {
    mocks.maybeSingle.mockResolvedValue({ data, error });
    await expect(computeRadarScores("user-1")).resolves.toEqual(scores);
    expect(mocks.live).toHaveBeenCalledWith("user-1");
  });

  it("surfaces a failed live fallback instead of fabricating scores", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.live.mockRejectedValue(new Error("database unavailable"));
    await expect(computeRadarScores("user-1")).rejects.toThrow("database unavailable");
  });
});
