import { cache } from "react";
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
  let query = db
    .from(VIEW_BY_PERIOD[period])
    .select(LEADERBOARD_SELECT)
    .order("total_cost", { ascending: false })
    .limit(limit);

  if (region) query = query.eq("region", region);
  if (cursor) query = query.lt("total_cost", cursor);

  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as LeaderboardRow[];
}

// Request-only deduplication keeps privacy changes and newly submitted usage live.
const loadCachedLeaderboard = cache(
  async (
    period: LeaderboardPeriod,
    region: string | null,
    cursor: string | null,
    limit: number
  ) => queryLeaderboard({ period, region, cursor, limit })
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
  const source = VIEW_BY_PERIOD[period];
  let entryQuery = db
    .from(source)
    .select("total_cost")
    .eq("user_id", userId);
  if (region) entryQuery = entryQuery.eq("region", region);
  const entry = await entryQuery.maybeSingle();

  if (entry.error || !entry.data) return null;

  let countQuery = db
    .from(source)
    .select("*", { count: "exact", head: true })
    .gt("total_cost", entry.data.total_cost);

  if (region) countQuery = countQuery.eq("region", region);

  const { count, error } = await countQuery;
  return error ? null : (count ?? 0) + 1;
}

const loadCachedLeaderboardRank = cache(queryLeaderboardRank);

export function loadLeaderboardRank(
  period: LeaderboardPeriod,
  userId: string,
  region?: string | null
) {
  return loadCachedLeaderboardRank(period, userId, region ?? null);
}
