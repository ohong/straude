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
    .select("id, username, display_name, avatar_url, bio, country, region, link, github_username, is_public, streak_freezes, referred_by, created_at")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // All independent queries in parallel
  const [
    followersRes,
    followingRes,
    postsRes,
    streakRes,
    totalCostRes,
    weeklyRes,
    followRes,
  ] = await Promise.all([
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
    supabase.rpc("calculate_user_streak", {
      p_user_id: profile.id,
      p_freeze_days: profile.streak_freezes ?? 0,
    }),
    supabase
      .from("daily_usage")
      .select("cost_usd.sum()")
      .eq("user_id", profile.id),
    profile.is_public && profile.username
      ? supabase
          .from("leaderboard_weekly")
          .select("total_cost")
          .eq("user_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    authUser && authUser.id !== profile.id
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_id", authUser.id)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ]);

  const streak = typeof streakRes.data === "number" ? streakRes.data : 0;
  const total_cost = Number((totalCostRes.data as any)?.[0]?.cost_usd ?? 0);
  const is_following = !!followRes.data;

  // Rank queries (depend on weekly leaderboard entry)
  let global_rank: number | undefined;
  let regional_rank: number | undefined;

  const userWeekly = weeklyRes.data as { total_cost: number } | null;
  if (userWeekly) {
    const rankPromises = [
      supabase
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true })
        .gt("total_cost", userWeekly.total_cost),
    ];
    if (profile.region) {
      rankPromises.push(
        supabase
          .from("leaderboard_weekly")
          .select("*", { count: "exact", head: true })
          .eq("region", profile.region)
          .gt("total_cost", userWeekly.total_cost)
      );
    }
    const rankResults = await Promise.all(rankPromises);
    global_rank = (rankResults[0].count ?? 0) + 1;
    if (profile.region && rankResults[1]) {
      regional_rank = (rankResults[1].count ?? 0) + 1;
    }
  }

  return NextResponse.json({
    ...profile,
    followers_count: followersRes.count ?? 0,
    following_count: followingRes.count ?? 0,
    posts_count: postsRes.count ?? 0,
    streak,
    total_cost,
    global_rank,
    regional_rank,
    is_following,
  });
}
