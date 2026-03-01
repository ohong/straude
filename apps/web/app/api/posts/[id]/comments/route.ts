import { NextResponse, type NextRequest } from "next/server";
import { after } from "@/lib/utils/after";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { parseMentions } from "@/lib/utils/mentions";
import { sendNotificationEmail } from "@/lib/email/send-comment-email";
import { checkAndAwardAchievements } from "@/lib/achievements";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Fire-and-forget: look up a user's email preference and send a notification email.
 * Never throws.
 */
async function fireNotificationEmail(opts: {
  recipientUserId: string;
  actorUsername: string;
  type: "comment" | "mention";
  content: string;
  postId: string;
  idempotencyKey: string;
}): Promise<void> {
  const prefField =
    opts.type === "mention"
      ? "email_mention_notifications"
      : "email_notifications";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      console.error("[email] Supabase service env missing; skipping notification email");
      return;
    }

    const db = getServiceClient();
    const [profileRes, authRes, postRes] = await Promise.all([
      db
        .from("users")
        .select(prefField)
        .eq("id", opts.recipientUserId)
        .single(),
      db.auth.admin.getUserById(opts.recipientUserId),
      db.from("posts").select("title").eq("id", opts.postId).single(),
    ]);

    if (profileRes.error) {
      console.error("[email] failed to load notification preferences:", profileRes.error.message);
      return;
    }
    if (!(profileRes.data as Record<string, unknown>)?.[prefField]) return;

    if (authRes.error) {
      console.error("[email] failed to load recipient auth record:", authRes.error.message);
      return;
    }

    const email = authRes.data?.user?.email;
    if (!email) return;

    await sendNotificationEmail({
      recipientUserId: opts.recipientUserId,
      recipientEmail: email,
      actorUsername: opts.actorUsername,
      type: opts.type,
      content: opts.content,
      postId: opts.postId,
      postTitle: (postRes.data?.title as string) ?? null,
      idempotencyKey: opts.idempotencyKey,
    });
  } catch (err) {
    console.error("[email] notification failed:", err);
  }
}

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

  // Defer notifications and achievements after the response is sent
  after(async () => {
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

      const commenterUsername =
        (comment.user as Record<string, unknown>)?.username as string ??
        "Someone";

      await fireNotificationEmail({
        recipientUserId: post.user_id,
        actorUsername: commenterUsername,
        type: "comment",
        content,
        postId: id,
        idempotencyKey: `comment-notif/${comment.id}`,
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
      const toNotify = (mentionedUsers ?? []).filter((u) => !skipIds.has(u.id));

      const mentionNotifs = toNotify.map((u) => ({
        user_id: u.id,
        actor_id: user.id,
        type: "mention" as const,
        post_id: id,
        comment_id: comment.id,
      }));

      if (mentionNotifs.length > 0) {
        await supabase.from("notifications").insert(mentionNotifs);
      }

      // Fire mention emails (one per mentioned user)
      const actorUsername =
        (comment.user as Record<string, unknown>)?.username as string ??
        "Someone";

      await Promise.allSettled(
        toNotify.map((u) =>
          fireNotificationEmail({
            recipientUserId: u.id,
            actorUsername,
            type: "mention",
            content,
            postId: id,
            idempotencyKey: `mention-notif/${comment.id}/${u.id}`,
          })
        )
      );
    }

    // Award comment achievements
    checkAndAwardAchievements(user.id, "comment").catch(() => {});
    if (post && post.user_id !== user.id) {
      checkAndAwardAchievements(post.user_id, "comment").catch(() => {});
    }
  });

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
