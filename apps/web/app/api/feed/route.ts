import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { normalizeCommentPreview, normalizeFeedPost, type JoinedUserSummary, type RawCommentPreviewRow } from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post } from "@/types";

type KudosRow = {
  post_id: string;
  user: JoinedUserSummary;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const type = searchParams.get("type") ?? "global";

  // Unauthenticated users can only access global and user (profile) feeds
  if (!user && type !== "global" && type !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse composite cursor: "date|created_at"
  let cursorDate: string | null = null;
  let cursorCreatedAt: string | null = null;
  if (cursor) {
    const sep = cursor.indexOf("|");
    if (sep !== -1) {
      cursorDate = cursor.slice(0, sep);
      cursorCreatedAt = cursor.slice(sep + 1);
    } else {
      // Legacy cursor format (plain created_at)
      cursorCreatedAt = cursor;
    }
  }

  // When viewing a profile, the client sends the profile owner's ID so
  // pagination continues fetching that user's posts instead of the viewer's.
  const profileUserId = searchParams.get("user_id");
  const effectiveUserId =
    type === "user" ? (profileUserId ?? user?.id ?? null) : (user?.id ?? null);

  if (type === "user") {
    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "user_id is required for user feed" },
        { status: 400 },
      );
    }

    if (!UUID_PATTERN.test(effectiveUserId)) {
      return NextResponse.json(
        { error: "user_id must be a valid UUID" },
        { status: 400 },
      );
    }

    const db = getServiceClient();
    const { data: profile, error: profileError } = await db
      .from("users")
      .select("id, is_public")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[feed] profile lookup error:", profileError);
      return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!profile.is_public && user?.id !== effectiveUserId) {
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: follow, error: followError } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", effectiveUserId)
        .maybeSingle();

      if (followError) {
        console.error("[feed] follow lookup error:", followError);
        return NextResponse.json({ error: "Unable to verify follow status" }, { status: 500 });
      }

      if (!follow) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const { data: rpcPosts, error } = await supabase.rpc("get_feed", {
    p_type: type,
    p_user_id: effectiveUserId,
    p_limit: limit,
    p_cursor_date: cursorDate,
    p_cursor_created_at: cursorCreatedAt,
  });
  const posts = ((rpcPosts ?? []) as FeedPostRow[]).map(normalizeFeedPost);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with kudos status, kudos users, and recent comments — all in parallel
  const postIds = posts.map((post) => post.id);

  const [{ data: userKudos }, { data: recentKudos, error: kudosError }, { data: recentComments }] =
    postIds.length
      ? await Promise.all([
          user
            ? supabase
                .from("kudos")
                .select("post_id")
                .eq("user_id", user.id)
                .in("post_id", postIds)
            : Promise.resolve({ data: [] as { post_id: string }[] }),
          supabase
            .from("kudos")
            .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
            .in("post_id", postIds)
            .order("created_at", { ascending: false })
            .limit(Math.min(postIds.length * 3, 60)),
          supabase
            .from("comments")
            .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
            .is("parent_comment_id", null)
            .in("post_id", postIds)
            .order("created_at", { ascending: false })
            .limit(Math.min(postIds.length * 2, 40)),
        ])
      : [
          { data: [] as { post_id: string }[] },
          { data: [] as KudosRow[], error: null },
          { data: [] as RawCommentPreviewRow[] },
        ];

  if (kudosError) {
    console.error("[feed] kudos users fetch error:", kudosError);
  }

  const kudosedSet = new Set((userKudos ?? []).map((k) => k.post_id));

  const kudosUsersMap = new Map<string, Array<{ avatar_url: string | null; username: string | null }>>();
  for (const kudos of (recentKudos ?? []) as KudosRow[]) {
    const list = kudosUsersMap.get(kudos.post_id) ?? [];
    const userSummary = firstRelation(kudos.user);
    if (list.length < 3 && userSummary) {
      list.push(userSummary);
      kudosUsersMap.set(kudos.post_id, list);
    }
  }

  const commentsMap = new Map<string, CommentPreviewItem[]>();
  for (const comment of (recentComments ?? []) as RawCommentPreviewRow[]) {
    const list = commentsMap.get(comment.post_id) ?? [];
    if (list.length < 2) {
      list.push(normalizeCommentPreview(comment));
      commentsMap.set(comment.post_id, list);
    }
  }
  // Reverse to chronological order for display
  for (const [, list] of commentsMap) {
    list.reverse();
  }

  const enriched = posts.map((post) => ({
    ...post,
    kudos_users: kudosUsersMap.get(post.id) ?? [],
    recent_comments: commentsMap.get(post.id) ?? [],
    has_kudosed: kudosedSet.has(post.id),
  }));

  // Build composite cursor: "date|created_at"
  let next_cursor: string | undefined;
  if (enriched.length === limit) {
    const last = enriched[enriched.length - 1];
    const date = last.daily_usage?.date;
    if (date) {
      next_cursor = `${date}|${last.created_at}`;
    }
  }

  // Include pending posts (sessions without details) for any tab.
  // Order by daily_usage.date — created_at clusters for backfilled posts so
  // sub-second tiebreakers would surface a near-random subset. !inner is
  // required for referencedTable ordering to apply to the parent rows.
  let pending_posts: Post[] = [];
  if (user && !cursor) {
    const { data } = await supabase
      .from("posts")
      .select("*, daily_usage:daily_usage!posts_daily_usage_id_fkey!inner(*)")
      .eq("user_id", user.id)
      .is("description", null)
      .eq("images", "[]")
      .order("date", { ascending: false, referencedTable: "daily_usage" })
      .order("created_at", { ascending: false })
      .limit(5);
    pending_posts = ((data ?? []) as FeedPostRow[]).map(normalizeFeedPost);
  }

  return NextResponse.json({ posts: enriched, next_cursor, pending_posts });
}
