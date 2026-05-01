import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { enrichFeedPosts, getFeedCursor, getPendingPosts } from "@/lib/feed-enrichment";
import type { FeedPostRow } from "@/types";

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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await enrichFeedPosts({
    posts: (rpcPosts ?? []) as FeedPostRow[],
    userId: user?.id ?? null,
    userScopedClient: supabase,
  });
  const next_cursor = getFeedCursor(enriched, limit);

  const pending_posts = user && !cursor
    ? await getPendingPosts(supabase, user.id)
    : [];

  return NextResponse.json({ posts: enriched, next_cursor, pending_posts });
}
