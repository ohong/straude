import { NextResponse } from "next/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  // Auth: verify CLI JWT from Authorization header
  const authHeader = request.headers.get("authorization");
  const userId = verifyCliToken(authHeader);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  // 1. User profile: username + level
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("username, streak_freezes")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: levelRow } = await db
    .from("user_levels")
    .select("level")
    .eq("user_id", userId)
    .maybeSingle();

  // 2. Daily usage (last 28 days)
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27); // 28 days including today
  const startStr = startDate.toISOString().split("T")[0];

  const { data: usage } = await db
    .from("daily_usage")
    .select("date, cost_usd")
    .eq("user_id", userId)
    .gte("date", startStr)
    .order("date", { ascending: true });

  const daily = (usage ?? []).map((d) => ({
    date: d.date as string,
    cost_usd: Number(d.cost_usd),
  }));

  // 3. Week costs: compute from daily array
  const todayStr = today.toISOString().split("T")[0];
  const d7 = new Date(today);
  d7.setDate(d7.getDate() - 6);
  const d7Str = d7.toISOString().split("T")[0];
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13);
  const d14Str = d14.toISOString().split("T")[0];

  let week_cost = 0;
  let prev_week_cost = 0;
  for (const entry of daily) {
    if (entry.date >= d7Str && entry.date <= todayStr) {
      week_cost += entry.cost_usd;
    } else if (entry.date >= d14Str && entry.date < d7Str) {
      prev_week_cost += entry.cost_usd;
    }
  }

  // 4. Streak
  const { data: streakData } = await db.rpc("calculate_user_streak", {
    p_user_id: userId,
    p_freeze_days: profile.streak_freezes ?? 0,
  });
  const streak = typeof streakData === "number" ? streakData : 0;

  // 5. Leaderboard neighbors
  let leaderboard: {
    rank: number;
    above: Array<{ username: string; cost: number; rank: number }>;
    below: Array<{ username: string; cost: number; rank: number }>;
  } | null = null;

  const { data: userEntry } = await db
    .from("leaderboard_weekly")
    .select("total_cost")
    .eq("user_id", userId)
    .maybeSingle();

  if (userEntry) {
    const userCost = Number(userEntry.total_cost);

    // Count users with higher cost to determine rank
    const { count } = await db
      .from("leaderboard_weekly")
      .select("*", { count: "exact", head: true })
      .gt("total_cost", userCost);

    const rank = (count ?? 0) + 1;

    // 2 rows with cost just above (closest higher costs)
    const { data: aboveRows } = await db
      .from("leaderboard_weekly")
      .select("username, total_cost")
      .gt("total_cost", userCost)
      .order("total_cost", { ascending: true })
      .limit(2);

    // 2 rows with cost just below (closest lower costs)
    const { data: belowRows } = await db
      .from("leaderboard_weekly")
      .select("username, total_cost")
      .lt("total_cost", userCost)
      .order("total_cost", { ascending: false })
      .limit(2);

    const above = (aboveRows ?? []).map((r) => {
      const cost = Number(r.total_cost);
      // Count how many users have cost greater than this user's cost
      // For users above, their rank = rank - index (since sorted ascending by cost)
      return { username: r.username as string, cost, rank: 0 };
    });

    // Assign ranks to above: they have higher cost, so lower rank number
    // aboveRows is sorted ascending by total_cost (closest first)
    // The closest above user has rank = our rank - 1, next is rank - 2, etc.
    for (let i = 0; i < above.length; i++) {
      above[i]!.rank = rank - (i + 1);
    }
    // Reverse so highest rank (lowest number) is first
    above.reverse();

    const below = (belowRows ?? []).map((r, i) => ({
      username: r.username as string,
      cost: Number(r.total_cost),
      rank: rank + (i + 1),
    }));

    leaderboard = { rank, above, below };
  }

  return NextResponse.json({
    username: profile.username,
    level: levelRow ? Number(levelRow.level) : null,
    streak,
    daily,
    week_cost,
    prev_week_cost,
    leaderboard,
  });
}
