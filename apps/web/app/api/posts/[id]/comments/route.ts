import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseMentions } from "@/lib/utils/mentions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await request.json();

  if (!content || typeof content !== "string" || content.length > 500) {
    return NextResponse.json(
      { error: "Content is required and must be at most 500 characters" },
      { status: 400 }
    );
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({ user_id: user.id, post_id: id, content })
    .select("*, user:users!comments_user_id_fkey(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert comment notification (skip self-comment)
  const { data: post } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", id)
    .single();
  if (post && post.user_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      actor_id: user.id,
      type: "comment",
      post_id: id,
      comment_id: comment.id,
    });
  }

  // Mention notifications (de-dup: skip self and post owner)
  const mentionedUsernames = parseMentions(content);
  if (mentionedUsernames.length > 0) {
    const { data: mentionedUsers } = await supabase
      .from("users")
      .select("id, username")
      .in("username", mentionedUsernames);

    const skipIds = new Set([user.id, post?.user_id].filter(Boolean));
    const mentionNotifs = (mentionedUsers ?? [])
      .filter((u) => !skipIds.has(u.id))
      .map((u) => ({
        user_id: u.id,
        actor_id: user.id,
        type: "mention" as const,
        post_id: id,
        comment_id: comment.id,
      }));

    if (mentionNotifs.length > 0) {
      supabase.from("notifications").insert(mentionNotifs).then(() => {});
    }
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  let query = supabase
    .from("comments")
    .select("*, user:users!comments_user_id_fkey(*)")
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt("created_at", cursor);
  }

  const { data: comments, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const next_cursor =
    (comments ?? []).length === limit
      ? comments![comments!.length - 1]?.created_at
      : undefined;

  return NextResponse.json({ comments: comments ?? [], next_cursor });
}
