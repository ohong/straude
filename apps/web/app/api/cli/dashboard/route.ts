import { NextResponse } from "next/server";
import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  // Auth: verify CLI JWT from Authorization header
  const authHeader = request.headers.get("authorization");
  const auth = verifyCliTokenWithRefresh(authHeader);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

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

  const [{ data: usage }, { data: lifetimeTokenRows }] = await Promise.all([
    db
      .from("daily_usage")
      .select("date, cost_usd")
      .eq("user_id", userId)
      .gte("date", startStr)
      .order("date", { ascending: true }),
    db
      .from("daily_usage")
      .select("output_tokens")
      .eq("user_id", userId),
  ]);

  const daily = (usage ?? []).map((d) => ({
    date: d.date as string,
    cost_usd: Number(d.cost_usd),
  }));

  const total_output_tokens = (lifetimeTokenRows ?? []).reduce(
    (sum, row) => sum + Number(row.output_tokens),
    0,
  );

  // 3. Week costs: compute from daily array
  const todayStr = today.toISOString().split("T")[0];
  const d7 = new Date(today);
  d7.setDate(d7.getDate() - 6);
  const d7Str = d7.toISOString().split("T")[0];
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13);
  const d14Str = d14.toISOString().split("T")[0];

  // 3b. Model breakdown (last 30 days aggregate)
  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 29);
  const d30Str = d30.toISOString().split("T")[0];
  const { data: breakdownRows } = await db
    .from("daily_usage")
    .select("model_breakdown")
    .eq("user_id", userId)
    .gte("date", d30Str)
    .not("model_breakdown", "is", null);

  const modelAgg = new Map<string, number>();
  for (const row of breakdownRows ?? []) {
    const entries = row.model_breakdown as Array<{ model: string; cost_usd: number }> | null;
    if (!entries) continue;
    for (const entry of entries) {
      modelAgg.set(entry.model, (modelAgg.get(entry.model) ?? 0) + entry.cost_usd);
    }
  }
  const model_breakdown = [...modelAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model, cost_usd]) => ({ model, cost_usd }));

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
    total_users: number;
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

    // Count users with higher cost to determine rank + total users for percentile
    const [{ count }, { count: totalCount }] = await Promise.all([
      db
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true })
        .gt("total_cost", userCost),
      db
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true }),
    ]);

    const rank = (count ?? 0) + 1;
    const totalUsers = totalCount ?? 0;

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

    leaderboard = { rank, total_users: totalUsers, above, below };
  }

  const headers: Record<string, string> = {};
  if (auth.refreshedToken) {
    headers["X-Straude-Refreshed-Token"] = auth.refreshedToken;
  }

  return NextResponse.json(
    {
      username: profile.username,
      level: levelRow ? Number(levelRow.level) : null,
      streak,
      daily,
      week_cost,
      prev_week_cost,
      leaderboard,
      model_breakdown,
      total_output_tokens,
    },
    { headers },
  );
}
