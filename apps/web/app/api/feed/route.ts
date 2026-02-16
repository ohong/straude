import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  // Get IDs of users the current user follows
  const { data: followData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = (followData ?? []).map((f) => f.following_id);

  if (followingIds.length === 0) {
    return NextResponse.json({ posts: [], next_cursor: undefined });
  }

  // Get posts from followed users
  let query = supabase
    .from("posts")
    .select(
      `
      *,
      user:users!posts_user_id_fkey(*),
      daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
      kudos_count:kudos(count),
      comment_count:comments(count)
    `
    )
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check which posts the current user has kudosed
  const postIds = (posts ?? []).map((p) => p.id);
  const { data: userKudos } = postIds.length
    ? await supabase
        .from("kudos")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds)
    : { data: [] };

  const kudosedSet = new Set((userKudos ?? []).map((k) => k.post_id));

  const enriched = (posts ?? []).map((p) => ({
    ...p,
    kudos_count: p.kudos_count?.[0]?.count ?? 0,
    comment_count: p.comment_count?.[0]?.count ?? 0,
    has_kudosed: kudosedSet.has(p.id),
  }));

  const next_cursor =
    enriched.length === limit
      ? enriched[enriched.length - 1]?.created_at
      : undefined;

  return NextResponse.json({ posts: enriched, next_cursor });
}
