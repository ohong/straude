import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeCommentPreview, normalizeFeedPost, type JoinedUserSummary, type RawCommentPreviewRow } from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post, UserSummary } from "@/types";

type KudosRow = {
  post_id: string;
  user: JoinedUserSummary;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const type = searchParams.get("type") ?? "global";

  // Unauthenticated users can only access the global feed
  if (!user && type !== "global") {
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

  const { data: rpcPosts, error } = await supabase.rpc("get_feed", {
    p_type: type,
    p_user_id: user?.id ?? null,
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

  // Include pending posts (sessions without details) for any tab
  let pending_posts: Post[] = [];
  if (user && !cursor) {
    const { data } = await supabase
      .from("posts")
      .select("*, daily_usage:daily_usage!posts_daily_usage_id_fkey(*)")
      .eq("user_id", user.id)
      .is("description", null)
      .eq("images", "[]")
      .order("created_at", { ascending: false })
      .limit(5);
    pending_posts = ((data ?? []) as FeedPostRow[]).map(normalizeFeedPost);
  }

  return NextResponse.json({ posts: enriched, next_cursor, pending_posts });
}
