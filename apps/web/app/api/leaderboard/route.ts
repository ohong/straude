import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_PERIODS = ["day", "week", "month", "all_time"] as const;
type Period = (typeof VALID_PERIODS)[number];

const VIEW_MAP: Record<Period, string> = {
  day: "leaderboard_daily",
  week: "leaderboard_weekly",
  month: "leaderboard_monthly",
  all_time: "leaderboard_all_time",
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = request.nextUrl;
  const period = (searchParams.get("period") ?? "week") as Period;
  const region = searchParams.get("region");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const view = VIEW_MAP[period];

  let query = supabase
    .from(view)
    .select("*")
    .order("total_cost", { ascending: false })
    .limit(limit);

  if (region) {
    query = query.eq("region", region);
  }

  if (cursor) {
    query = query.lt("total_cost", cursor);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch streaks for all returned users in a single RPC call
  const userIds = (entries ?? []).map((e) => e.user_id);
  const { data: streakRows } = userIds.length > 0
    ? await supabase.rpc("calculate_streaks_batch", { p_user_ids: userIds })
    : { data: [] };

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  // Assign ranks and streaks
  const ranked = (entries ?? []).map((entry, i) => ({
    ...entry,
    rank: i + 1,
    streak: streakMap.get(entry.user_id) ?? 0,
  }));

  // Find current user's rank
  let user_rank: number | undefined;
  if (user) {
    const found = ranked.find((e) => e.user_id === user.id);
    if (found) {
      user_rank = found.rank;
    } else {
      // User not in this page — query their rank separately
      let rankQuery = supabase
        .from(view)
        .select("*", { count: "exact", head: true })
        .gt("total_cost", 0);

      if (region) {
        rankQuery = rankQuery.eq("region", region);
      }

      // Get user's cost from the view
      const { data: userEntry } = await supabase
        .from(view)
        .select("total_cost")
        .eq("user_id", user.id)
        .maybeSingle();

      if (userEntry) {
        const { count } = await supabase
          .from(view)
          .select("*", { count: "exact", head: true })
          .gt("total_cost", userEntry.total_cost);

        user_rank = (count ?? 0) + 1;
      }
    }
  }

  const next_cursor =
    ranked.length === limit
      ? ranked[ranked.length - 1]?.total_cost?.toString()
      : undefined;

  return NextResponse.json({ entries: ranked, user_rank, next_cursor });
}
