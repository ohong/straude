import type { SupabaseClient } from "@supabase/supabase-js";
import { prettifyModel } from "@/lib/utils/post-share";

export interface ProfileShareCardData {
  username: string;
  display_name: string | null;
  is_public: boolean;
  streak: number;
  total_output_tokens: number;
  recent_output_tokens: number;
  active_days_last_30: number;
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

  if (counts.size === 0) return "Mixed models";

  const topModel = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return topModel ? prettifyModel(topModel) : "Mixed models";
}

export async function getProfileShareCardData(
  supabase: SupabaseClient,
  profile: ProfileRow
): Promise<ProfileShareCardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recentStart = new Date(today);
  recentStart.setDate(recentStart.getDate() - 29);

  const heatmapStart = new Date(today);
  heatmapStart.setDate(heatmapStart.getDate() - 364);

  const [{ data: contributionRows }, { data: lifetimeRows }, { data: recentRows }, { data: streakData }] =
    await Promise.all([
      supabase
        .from("daily_usage")
        .select("date, cost_usd")
        .eq("user_id", profile.id)
        .gte("date", formatDate(heatmapStart))
        .order("date", { ascending: true }),
      supabase
        .from("daily_usage")
        .select("output_tokens")
        .eq("user_id", profile.id),
      supabase
        .from("daily_usage")
        .select("date, output_tokens, models")
        .eq("user_id", profile.id)
        .gte("date", formatDate(recentStart)),
      supabase.rpc("calculate_user_streak", { p_user_id: profile.id }),
    ]);

  const contribution_data = (contributionRows ?? []).map((row) => ({
    date: row.date,
    cost_usd: Number(row.cost_usd),
  }));

  const total_output_tokens = (lifetimeRows ?? []).reduce(
    (sum, row) => sum + Number(row.output_tokens),
    0
  );

  const recent_output_tokens = (recentRows ?? []).reduce(
    (sum, row) => sum + Number(row.output_tokens),
    0
  );

  return {
    username: profile.username ?? "anonymous",
    display_name: profile.display_name,
    is_public: profile.is_public,
    streak: typeof streakData === "number" ? streakData : 0,
    total_output_tokens,
    recent_output_tokens,
    active_days_last_30: recentRows?.length ?? 0,
    primary_model: resolvePrimaryModel(recentRows ?? []),
    contribution_data,
  };
}
