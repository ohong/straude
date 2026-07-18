import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ from: mocks.from })),
}));

import { loadLeaderboardEntries } from "@/lib/data/leaderboard";

function queryResult(result: Record<string, unknown>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (
      resolve: (value: Record<string, unknown>) => unknown,
      reject?: (error: unknown) => unknown
    ) => Promise<unknown>;
  } = {};
  for (const method of ["select", "eq", "order", "limit", "lt"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("leaderboard snapshot loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns snapshot rows without touching the fallback view", async () => {
    const snapshot = queryResult({
      data: [{ user_id: "u1", username: "alice", total_cost: 10 }],
      error: null,
    });
    mocks.from.mockReturnValue(snapshot);

    await expect(
      loadLeaderboardEntries({ period: "week", limit: 5 })
    ).resolves.toMatchObject([{ user_id: "u1", username: "alice" }]);

    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("leaderboard_snapshots");
    expect(snapshot.eq).toHaveBeenCalledWith("period", "week");
  });

  it("falls back to the existing view before the migration is live", async () => {
    const missingSnapshot = queryResult({
      data: null,
      error: { message: "relation does not exist" },
    });
    const fallback = queryResult({
      data: [{ user_id: "u2", username: "bob", total_cost: 5 }],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(missingSnapshot)
      .mockReturnValueOnce(fallback);

    await expect(
      loadLeaderboardEntries({
        period: "month",
        region: "europe",
        limit: 10,
      })
    ).resolves.toMatchObject([{ user_id: "u2", username: "bob" }]);

    expect(mocks.from.mock.calls.map((call) => call[0])).toEqual([
      "leaderboard_snapshots",
      "leaderboard_monthly",
    ]);
    expect(fallback.eq).toHaveBeenCalledWith("region", "europe");
  });
});
