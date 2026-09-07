import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ from: mocks.from })),
}));

import { loadLeaderboardEntries, loadLeaderboardRank } from "@/lib/data/leaderboard";

function queryResult(result: Record<string, unknown>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (
      resolve: (value: Record<string, unknown>) => unknown,
      reject?: (error: unknown) => unknown
    ) => Promise<unknown>;
  } = {};
  for (const method of ["select", "eq", "order", "limit", "lt", "gt", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("live leaderboard loaders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads current usage and visibility from the live period view", async () => {
    const query = queryResult({
      data: [{ user_id: "u1", username: "alice", total_cost: 10 }],
      error: null,
    });
    mocks.from.mockReturnValue(query);
    await expect(loadLeaderboardEntries({ period: "week", limit: 5 }))
      .resolves.toMatchObject([{ user_id: "u1", username: "alice" }]);
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("leaderboard_weekly");
  });

  it("keeps region and pagination filters on the live listing", async () => {
    const query = queryResult({ data: [], error: null });
    mocks.from.mockReturnValue(query);
    await expect(loadLeaderboardEntries({ period: "month", region: "europe", cursor: "5", limit: 10 }))
      .resolves.toEqual([]);
    expect(mocks.from).toHaveBeenCalledWith("leaderboard_monthly");
    expect(query.eq).toHaveBeenCalledWith("region", "europe");
    expect(query.lt).toHaveBeenCalledWith("total_cost", "5");
  });

  it("uses the same live rank source as the CLI immediately after a push", async () => {
    const entry = queryResult({ data: { total_cost: 10 }, error: null });
    const above = queryResult({ data: null, count: 2, error: null });
    mocks.from.mockReturnValueOnce(entry).mockReturnValueOnce(above);
    await expect(loadLeaderboardRank("week", "new-user", "europe")).resolves.toBe(3);
    expect(mocks.from.mock.calls.map(([source]) => source))
      .toEqual(["leaderboard_weekly", "leaderboard_weekly"]);
    expect(entry.eq).toHaveBeenCalledWith("region", "europe");
    expect(above.gt).toHaveBeenCalledWith("total_cost", 10);
    expect(above.eq).toHaveBeenCalledWith("region", "europe");
  });

  it("returns no rank outside the selected region or after a user becomes private", async () => {
    mocks.from.mockReturnValue(queryResult({ data: null, error: null }));
    await expect(loadLeaderboardRank("week", "private-user", "europe")).resolves.toBeNull();
    expect(mocks.from).toHaveBeenCalledOnce();
  });

  it("surfaces a failed live query instead of returning an empty board", async () => {
    mocks.from.mockReturnValue(queryResult({ data: null, error: { message: "unavailable" } }));
    await expect(loadLeaderboardEntries({ period: "day", limit: 5 })).rejects.toThrow("unavailable");
  });
});
