import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type OpenStats,
  type OpenStatsDb,
  getOpenStatsForPage,
} from "@/lib/open-stats";

type FixtureOptions = {
  usageRows?: unknown[];
  usageError?: { message: string } | null;
  concentrationRows?: unknown[];
  concentrationError?: { message: string } | null;
  growthRows?: unknown[];
  growthError?: { message: string } | null;
  snapshotRows?: unknown[];
  snapshotError?: { message: string } | null;
  upsertError?: { message: string } | null;
};

function makeSnapshotStats(overrides: Partial<OpenStats> = {}): OpenStats {
  return {
    trackedUsers: 87,
    totalUsers: 87,
    totalSpend: 94833,
    avgWeeklySpend: 42.5,
    totalTokens: 146_600_000_000,
    totalSessions: 1072,
    avgStreak: 7,
    concentration: [
      {
        segment: "top_1",
        user_count: 1,
        total_spend: 15359.39,
        pct_of_total: 14.2,
      },
    ],
    cumulativePct: { top_1: 14, top_5: 42, top_10: 70 },
    models: [{ name: "Claude Opus", pct: 62 }],
    fetchedAt: "2026-04-01T12:00:00.000Z",
    snapshotDate: "2026-04-01",
    source: "live",
    ...overrides,
  };
}

function makeDb(options: FixtureOptions = {}) {
  const snapshotUpsert = vi.fn().mockResolvedValue({
    error: options.upsertError ?? null,
  });

  const db: OpenStatsDb = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "daily_usage") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: options.usageRows ?? [],
              error: options.usageError ?? null,
            }),
          }),
        };
      }

      if (table === "open_stats_snapshots") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: options.snapshotRows ?? [],
                error: options.snapshotError ?? null,
              }),
            }),
          }),
          upsert: snapshotUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === "admin_revenue_concentration") {
        return Promise.resolve({
          data: options.concentrationRows ?? [],
          error: options.concentrationError ?? null,
        });
      }

      if (fn === "admin_growth_metrics") {
        return Promise.resolve({
          data: options.growthRows ?? [],
          error: options.growthError ?? null,
        });
      }

      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };

  return { db, snapshotUpsert };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getOpenStatsForPage", () => {
  it("returns live stats and writes the latest snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const { db, snapshotUpsert } = makeDb({
      usageRows: [
        {
          session_count: 4,
          total_tokens: 1200,
          cost_usd: 12.5,
          user_id: "user-1",
          date: "2026-04-01",
          model_breakdown: [{ model: "claude-opus-4-6", cost_usd: 12.5 }],
        },
      ],
      concentrationRows: [
        {
          segment: "top_1",
          user_count: 1,
          total_spend: 12.5,
          pct_of_total: 100,
        },
      ],
      growthRows: [{ date: "2026-04-01", signups: 87, cumulative_users: 87 }],
    });

    const stats = await getOpenStatsForPage(db);

    expect(stats.source).toBe("live");
    expect(stats.totalSpend).toBe(12.5);
    expect(stats.trackedUsers).toBe(1);
    expect(stats.totalUsers).toBe(87);
    expect(stats.models).toEqual([{ name: "Claude Opus", pct: 100 }]);
    expect(snapshotUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot_date: "2026-04-01",
        captured_at: "2026-04-01T12:00:00.000Z",
      }),
      { onConflict: "snapshot_date" },
    );
  });

  it("falls back to the latest snapshot when the live query fails", async () => {
    const snapshotStats = makeSnapshotStats();
    const { db, snapshotUpsert } = makeDb({
      usageError: { message: "database offline" },
      snapshotRows: [
        {
          snapshot_date: "2026-04-01",
          captured_at: "2026-04-01T12:00:00.000Z",
          stats: snapshotStats,
        },
      ],
    });

    const stats = await getOpenStatsForPage(db);

    expect(stats.source).toBe("snapshot");
    expect(stats.totalSpend).toBe(snapshotStats.totalSpend);
    expect(stats.fetchedAt).toBe(snapshotStats.fetchedAt);
    expect(snapshotUpsert).not.toHaveBeenCalled();
  });

  it("falls back to the latest snapshot when live stats come back empty", async () => {
    const snapshotStats = makeSnapshotStats({
      totalSpend: 101_001,
      snapshotDate: "2026-03-31",
      fetchedAt: "2026-03-31T23:59:59.000Z",
    });
    const { db } = makeDb({
      usageRows: [],
      concentrationRows: [],
      growthRows: [],
      snapshotRows: [
        {
          snapshot_date: "2026-03-31",
          captured_at: "2026-03-31T23:59:59.000Z",
          stats: snapshotStats,
        },
      ],
    });

    const stats = await getOpenStatsForPage(db);

    expect(stats.source).toBe("snapshot");
    expect(stats.totalSpend).toBe(101_001);
    expect(stats.snapshotDate).toBe("2026-03-31");
  });
});
