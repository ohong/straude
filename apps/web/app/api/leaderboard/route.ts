import { NextResponse, type NextRequest } from "next/server";
import {
  LEADERBOARD_PERIODS,
  loadLeaderboardEntries,
  loadLeaderboardRank,
  type LeaderboardPeriod,
} from "@/lib/data/leaderboard";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const [supabase, identity] = await Promise.all([
    createClient(),
    getAuthIdentity(),
  ]);
  const db = getServiceClient();

  const { searchParams } = request.nextUrl;
  const requestedPeriod = searchParams.get("period") ?? "week";
  const region = searchParams.get("region");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  if (!LEADERBOARD_PERIODS.includes(requestedPeriod as LeaderboardPeriod)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const period = requestedPeriod as LeaderboardPeriod;
  let entries;
  try {
    entries = await loadLeaderboardEntries({ period, region, cursor, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Leaderboard unavailable" },
      { status: 500 }
    );
  }

  // Fetch streaks for all returned users in a single RPC call
  const userIds = entries.map((entry) => entry.user_id);
  const { data: streakRows } = userIds.length > 0
    ? await supabase.rpc("calculate_streaks_batch", { p_user_ids: userIds })
    : { data: [] };

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  const { data: levelRows } = userIds.length > 0
    ? await db
        .from("user_levels")
        .select("user_id, level")
        .in("user_id", userIds)
    : { data: [] };

  const levelMap = new Map<string, number>();
  for (const row of levelRows ?? []) {
    levelMap.set(row.user_id, Number(row.level));
  }

  // Assign ranks and streaks
  const ranked = entries.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    streak: streakMap.get(entry.user_id) ?? 0,
    level: levelMap.get(entry.user_id),
  }));

  // Find current user's rank
  let user_rank: number | undefined;
  if (identity) {
    const found = ranked.find((e) => e.user_id === identity.id);
    if (found) {
      user_rank = found.rank;
    } else {
      user_rank =
        (await loadLeaderboardRank(period, identity.id, region)) ?? undefined;
    }
  }

  const next_cursor =
    ranked.length === limit
      ? ranked[ranked.length - 1]?.total_cost?.toString()
      : undefined;

  return NextResponse.json({ entries: ranked, user_rank, next_cursor });
}
