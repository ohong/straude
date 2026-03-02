import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: posts, error } = await supabase.rpc("get_feed", {
    p_type: type,
    p_user_id: user?.id ?? null,
    p_limit: limit,
    p_cursor_date: cursorDate,
    p_cursor_created_at: cursorCreatedAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with kudos status, kudos users, and recent comments — all in parallel
  const postIds = (posts ?? []).map((p: any) => p.id);

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
            .limit(postIds.length * 3),
          supabase
            .from("comments")
            .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
            .in("post_id", postIds)
            .order("created_at", { ascending: false })
            .limit(postIds.length * 2),
        ])
      : [{ data: [] as any[] }, { data: [] as any[], error: null }, { data: [] as any[] }];

  if (kudosError) {
    console.error("[feed] kudos users fetch error:", kudosError);
  }

  const kudosedSet = new Set((userKudos ?? []).map((k) => k.post_id));

  const kudosUsersMap = new Map<string, Array<{ avatar_url: string | null; username: string | null }>>();
  for (const k of recentKudos ?? []) {
    const list = kudosUsersMap.get(k.post_id) ?? [];
    if (list.length < 3) {
      list.push(k.user as any);
      kudosUsersMap.set(k.post_id, list);
    }
  }

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

  const enriched = (posts ?? []).map((p: any) => ({
    ...p,
    kudos_count: typeof p.kudos_count === "number" ? p.kudos_count : p.kudos_count?.[0]?.count ?? 0,
    kudos_users: kudosUsersMap.get(p.id) ?? [],
    comment_count: typeof p.comment_count === "number" ? p.comment_count : p.comment_count?.[0]?.count ?? 0,
    recent_comments: commentsMap.get(p.id) ?? [],
    has_kudosed: kudosedSet.has(p.id),
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

  return NextResponse.json({ posts: enriched, next_cursor });
}
