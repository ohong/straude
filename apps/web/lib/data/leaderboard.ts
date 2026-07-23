import { unstable_cache } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";

export const LEADERBOARD_PERIODS = ["day", "week", "month", "all_time"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export type LeaderboardRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  region: string | null;
  total_cost: number | string | null;
  total_output_tokens: number | string | null;
};

type LeaderboardQuery = {
  period: LeaderboardPeriod;
  region?: string | null;
  cursor?: string | null;
  limit: number;
};

const VIEW_BY_PERIOD: Record<LeaderboardPeriod, string> = {
  day: "leaderboard_daily",
  week: "leaderboard_weekly",
  month: "leaderboard_monthly",
  all_time: "leaderboard_all_time",
};

const LEADERBOARD_SELECT =
  "user_id, username, display_name, avatar_url, country, region, total_cost, total_output_tokens";

async function queryLeaderboard({
  period,
  region,
  cursor,
  limit,
}: LeaderboardQuery): Promise<LeaderboardRow[]> {
  const db = getServiceClient();
  let snapshotQuery = db
    .from("leaderboard_snapshots")
    .select(LEADERBOARD_SELECT)
    .eq("period", period)
    .order("total_cost", { ascending: false })
    .limit(limit);

  if (region) snapshotQuery = snapshotQuery.eq("region", region);
  if (cursor) snapshotQuery = snapshotQuery.lt("total_cost", cursor);

  const snapshot = await snapshotQuery;
  if (!snapshot.error) {
    return (snapshot.data ?? []) as LeaderboardRow[];
  }

  let fallbackQuery = db
    .from(VIEW_BY_PERIOD[period])
    .select(LEADERBOARD_SELECT)
    .order("total_cost", { ascending: false })
    .limit(limit);

  if (region) fallbackQuery = fallbackQuery.eq("region", region);
  if (cursor) fallbackQuery = fallbackQuery.lt("total_cost", cursor);

  const fallback = await fallbackQuery;
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as LeaderboardRow[];
}

const loadCachedLeaderboard = unstable_cache(
  async (
    period: LeaderboardPeriod,
    region: string | null,
    cursor: string | null,
    limit: number
  ) => queryLeaderboard({ period, region, cursor, limit }),
  ["public-leaderboard-snapshot-first"],
  { revalidate: 600, tags: ["leaderboard"] }
);

export function loadLeaderboardEntries(query: LeaderboardQuery) {
  return loadCachedLeaderboard(
    query.period,
    query.region ?? null,
    query.cursor ?? null,
    query.limit
  );
}

async function queryLeaderboardRank(
  period: LeaderboardPeriod,
  userId: string,
  region: string | null
): Promise<number | null> {
  const db = getServiceClient();
  const snapshotEntry = await db
    .from("leaderboard_snapshots")
    .select("total_cost")
    .eq("period", period)
    .eq("user_id", userId)
    .maybeSingle();

  const source = snapshotEntry.error
    ? VIEW_BY_PERIOD[period]
    : "leaderboard_snapshots";
  const entry = snapshotEntry.error
    ? await db
        .from(source)
        .select("total_cost")
        .eq("user_id", userId)
        .maybeSingle()
    : snapshotEntry;

  if (entry.error || !entry.data) return null;

  let countQuery = db
    .from(source)
    .select("*", { count: "exact", head: true })
    .gt("total_cost", entry.data.total_cost);

  if (source === "leaderboard_snapshots") {
    countQuery = countQuery.eq("period", period);
  }
  if (region) countQuery = countQuery.eq("region", region);

  const { count, error } = await countQuery;
  return error ? null : (count ?? 0) + 1;
}

const loadCachedLeaderboardRank = unstable_cache(
  queryLeaderboardRank,
  ["public-leaderboard-rank-snapshot-first"],
  { revalidate: 600, tags: ["leaderboard"] }
);

export function loadLeaderboardRank(
  period: LeaderboardPeriod,
  userId: string,
  region?: string | null
) {
  return loadCachedLeaderboardRank(period, userId, region ?? null);
}
