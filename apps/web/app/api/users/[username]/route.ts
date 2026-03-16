import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getProfileAccessContext } from "@/lib/profile-access";

type RouteContext = { params: Promise<{ username: string }> };
type PublicProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  link: string | null;
  github_username: string | null;
  is_public: boolean;
  streak_freezes: number | null;
  referred_by: string | null;
  created_at: string;
};
type TotalCostAggregateRow = {
  cost_usd: number | string | null;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const access = await getProfileAccessContext<PublicProfileRow>(
    username,
    "id, username, display_name, avatar_url, bio, country, region, link, github_username, is_public, streak_freezes, referred_by, created_at",
  );

  if (!access) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!access.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { authUserId, isOwn, isFollowing, profile } = access;
  const db = getServiceClient();

  // All independent queries in parallel
  const [
    followersRes,
    followingRes,
    postsRes,
    streakRes,
    totalCostRes,
    levelRes,
    weeklyRes,
  ] = await Promise.all([
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    db
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
    db.rpc("calculate_user_streak", {
      p_user_id: profile.id,
      p_freeze_days: profile.streak_freezes ?? 0,
    }),
    db
      .from("daily_usage")
      .select("cost_usd.sum()")
      .eq("user_id", profile.id),
    db
      .from("user_levels")
      .select("level")
      .eq("user_id", profile.id)
      .maybeSingle(),
    profile.is_public && profile.username
      ? db
          .from("leaderboard_weekly")
          .select("total_cost")
          .eq("user_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ]);

  const streak = typeof streakRes.data === "number" ? streakRes.data : 0;
  const totalCostRows = totalCostRes.data as TotalCostAggregateRow[] | null;
  const total_cost = Number(totalCostRows?.[0]?.cost_usd ?? 0);
  const is_following = !isOwn && !!authUserId && isFollowing;

  // Rank queries (depend on weekly leaderboard entry)
  let global_rank: number | undefined;
  let regional_rank: number | undefined;

  const userWeekly = weeklyRes.data as { total_cost: number } | null;
  if (userWeekly) {
    const rankPromises = [
      db
        .from("leaderboard_weekly")
        .select("*", { count: "exact", head: true })
        .gt("total_cost", userWeekly.total_cost),
    ];
    if (profile.region) {
      rankPromises.push(
        db
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
    level: levelRes.data?.level ? Number(levelRes.data.level) : null,
    global_rank,
    regional_rank,
    is_following,
  });
}
