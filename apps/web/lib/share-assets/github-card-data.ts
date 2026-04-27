import type { SupabaseClient } from "@supabase/supabase-js";
import { prettifyModel } from "@/lib/utils/post-share";

export interface GithubCardData {
  username: string;
  display_name: string | null;
  streak: number;
  total_cost: number;
  active_days_last_30: number;
  level: number | null;
  global_rank: number | null;
  total_users: number | null;
  primary_model: string;
  contribution_data: Array<{ date: string; cost_usd: number }>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  is_public: boolean;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolvePrimaryModel(
  rows: Array<{ models: string[] | null }>
): string {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const model of row.models ?? []) {
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return "—";

  const topModel = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return topModel ? prettifyModel(topModel) : "—";
}

export async function getGithubCardData(
  supabase: SupabaseClient,
  profile: ProfileRow
): Promise<GithubCardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const heatmapStart = new Date(today);
  heatmapStart.setDate(heatmapStart.getDate() - 83); // 84 days including today

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);

  const [
    { data: streakData },
    { data: recentRows },
    { data: allCostRows },
    { data: levelRow },
    { data: leaderboardEntry },
  ] = await Promise.all([
    supabase.rpc("calculate_user_streak", { p_user_id: profile.id }),
    supabase
      .from("daily_usage")
      .select("date, cost_usd, models")
      .eq("user_id", profile.id)
      .gte("date", formatDate(heatmapStart))
      .order("date", { ascending: true }),
    supabase
      .from("daily_usage")
      .select("cost_usd")
      .eq("user_id", profile.id),
    supabase
      .from("user_levels")
      .select("level")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("leaderboard_weekly")
      .select("total_cost")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  // Total lifetime cost
  const total_cost = (allCostRows ?? []).reduce(
    (sum, row) => sum + Number(row.cost_usd),
    0
  );

  // Contribution data for heatmap (84 days)
  const contribution_data = (recentRows ?? []).map((row) => ({
    date: row.date as string,
    cost_usd: Number(row.cost_usd),
  }));

  // Active days in last 30
  const active_days_last_30 = (recentRows ?? []).filter(
    (row) => (row.date as string) >= thirtyDaysAgoStr
  ).length;

  // Primary model from recent rows
  const primary_model = resolvePrimaryModel(recentRows ?? []);

  // Rank: count users with higher weekly cost
  let global_rank: number | null = null;
  let total_users: number | null = null;

  if (leaderboardEntry) {
    const userCost = Number(leaderboardEntry.total_cost);
    const [{ count: aboveCount }, { count: totalCount }] = await Promise.all([
      supabase
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true })
        .gt("total_cost", userCost),
      supabase
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true }),
    ]);
    global_rank = (aboveCount ?? 0) + 1;
    total_users = totalCount ?? 0;
  }

  return {
    username: profile.username ?? "anonymous",
    display_name: profile.display_name,
    streak: typeof streakData === "number" ? streakData : 0,
    total_cost,
    active_days_last_30,
    level: levelRow ? Number(levelRow.level) : null,
    global_rank,
    total_users,
    primary_model,
    contribution_data,
  };
}
