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
  const type = searchParams.get("type") ?? "global";

  const baseFields = `
    daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
    kudos_count:kudos(count),
    comment_count:comments(count)
  `;

  let query;

  if (type === "global") {
    // Use !inner join to filter posts where the user is public
    query = supabase
      .from("posts")
      .select(`*, user:users!posts_user_id_fkey!inner(*), ${baseFields}`)
      .eq("user.is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);
  } else {
    query = supabase
      .from("posts")
      .select(`*, user:users!posts_user_id_fkey(*), ${baseFields}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type === "mine") {
      query = query.eq("user_id", user.id);
    } else {
      // following: own posts + posts from followed users
      const { data: followData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = (followData ?? []).map((f) => f.following_id);
      const feedUserIds = [user.id, ...followingIds];
      query = query.in("user_id", feedUserIds);
    }
  }

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

  // Fetch recent kudos users (up to 3 per post for avatar display)
  const { data: recentKudos, error: kudosError } = postIds.length
    ? await supabase
        .from("kudos")
        .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
        .limit(postIds.length * 3)
    : { data: [], error: null };

  if (kudosError) {
    console.error("[feed] kudos users fetch error:", kudosError);
  }

  const kudosUsersMap = new Map<string, Array<{ avatar_url: string | null; username: string | null }>>();
  for (const k of recentKudos ?? []) {
    const list = kudosUsersMap.get(k.post_id) ?? [];
    if (list.length < 3) {
      list.push(k.user as any);
      kudosUsersMap.set(k.post_id, list);
    }
  }

  // Fetch recent comments (up to 2 per post for inline preview)
  const { data: recentComments } = postIds.length
    ? await supabase
        .from("comments")
        .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const commentsMap = new Map<string, Array<any>>();
  for (const c of recentComments ?? []) {
    const list = commentsMap.get(c.post_id) ?? [];
    if (list.length < 2) {
      list.push(c);
      commentsMap.set(c.post_id, list);
    }
  }
  // Reverse to chronological order for display
  for (const [, list] of commentsMap) {
    list.reverse();
  }

  const enriched = (posts ?? []).map((p) => ({
    ...p,
    kudos_count: p.kudos_count?.[0]?.count ?? 0,
    kudos_users: kudosUsersMap.get(p.id) ?? [],
    comment_count: p.comment_count?.[0]?.count ?? 0,
    recent_comments: commentsMap.get(p.id) ?? [],
    has_kudosed: kudosedSet.has(p.id),
  }));

  const next_cursor =
    enriched.length === limit
      ? enriched[enriched.length - 1]?.created_at
      : undefined;

  return NextResponse.json({ posts: enriched, next_cursor });
}
