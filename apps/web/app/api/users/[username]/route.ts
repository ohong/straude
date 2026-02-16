import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Follower / following counts
  const [{ count: followers_count }, { count: following_count }, { count: posts_count }] =
    await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id),
    ]);

  // Streak: consecutive days with usage, ending today or yesterday
  const { data: streakData } = await supabase.rpc("calculate_user_streak", {
    p_user_id: profile.id,
  });
  const streak = typeof streakData === "number" ? streakData : 0;

  // Total spend
  const { data: totalData } = await supabase
    .from("daily_usage")
    .select("cost_usd")
    .eq("user_id", profile.id);

  const total_cost = (totalData ?? []).reduce(
    (sum, d) => sum + Number(d.cost_usd),
    0
  );

  // Ranks from materialized views
  let global_rank: number | undefined;
  let regional_rank: number | undefined;

  if (profile.is_public && profile.username) {
    const { data: userWeekly } = await supabase
      .from("leaderboard_weekly")
      .select("total_cost")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (userWeekly) {
      const { count } = await supabase
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true })
        .gt("total_cost", userWeekly.total_cost);

      global_rank = (count ?? 0) + 1;

      if (profile.region) {
        const { count: regCount } = await supabase
          .from("leaderboard_weekly")
          .select("*", { count: "exact", head: true })
          .eq("region", profile.region)
          .gt("total_cost", userWeekly.total_cost);

        regional_rank = (regCount ?? 0) + 1;
      }
    }
  }

  // Is current user following this profile?
  let is_following = false;
  if (authUser && authUser.id !== profile.id) {
    const { data: follow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", authUser.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    is_following = !!follow;
  }

  return NextResponse.json({
    ...profile,
    followers_count: followers_count ?? 0,
    following_count: following_count ?? 0,
    posts_count: posts_count ?? 0,
    streak,
    total_cost,
    global_rank,
    regional_rank,
    is_following,
  });
}
