import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { parseMentions } from "@/lib/utils/mentions";
import { sendNotificationEmail } from "@/lib/email/send-comment-email";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Start post + kudos queries in parallel (avoid waterfall)
  const postPromise = supabase
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
    .eq("id", id)
    .single();

  const kudosPromise = user
    ? supabase
        .from("kudos")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const kudosUsersPromise = supabase
    .from("kudos")
    .select("user:users!kudos_user_id_fkey(avatar_url, username)")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(3);

  const [{ data: post, error }, { data: kudos }, { data: recentKudos }] =
    await Promise.all([postPromise, kudosPromise, kudosUsersPromise]);

  if (error || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...post,
    kudos_count: post.kudos_count?.[0]?.count ?? 0,
    kudos_users: (recentKudos ?? []).map((k) => k.user),
    comment_count: post.comment_count?.[0]?.count ?? 0,
    has_kudosed: !!kudos,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (body.title !== null && (typeof body.title !== "string" || body.title.length > 100)) {
      return NextResponse.json(
        { error: "Title must be a string of at most 100 characters" },
        { status: 400 }
      );
    }
    updates.title = body.title;
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 5000)) {
      return NextResponse.json(
        { error: "Description must be a string of at most 5000 characters" },
        { status: 400 }
      );
    }
    updates.description = body.description;
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > 10) {
      return NextResponse.json(
        { error: "Images must be an array of at most 10 URLs" },
        { status: 400 }
      );
    }
    updates.images = body.images;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: post, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !post) {
    return NextResponse.json(
      { error: "Post not found or not yours" },
      { status: 404 }
    );
  }

  // Mention notifications on description edit
  if (post.description) {
    const mentionedUsernames = parseMentions(post.description);
    if (mentionedUsernames.length > 0) {
      const { data: mentionedUsers } = await supabase
        .from("users")
        .select("id, username")
        .in("username", mentionedUsernames);

      const toNotify = (mentionedUsers ?? []).filter(
        (u) => u.id !== user.id,
      );

      const mentionNotifs = toNotify.map((u) => ({
        user_id: u.id,
        actor_id: user.id,
        type: "mention" as const,
        post_id: id,
      }));

      if (mentionNotifs.length > 0) {
        supabase.from("notifications").insert(mentionNotifs).then(() => {});
      }

      // Fire mention emails
      if (toNotify.length > 0) {
        const db = getServiceClient();
        const { data: actor } = await db
          .from("users")
          .select("username")
          .eq("id", user.id)
          .single();
        const actorUsername = actor?.username ?? "Someone";

        for (const u of toNotify) {
          const sdb = getServiceClient();
          Promise.all([
            sdb
              .from("users")
              .select("email_notifications")
              .eq("id", u.id)
              .single(),
            sdb.auth.admin.getUserById(u.id),
          ])
            .then(([profileRes, authRes]) => {
              const email = authRes.data?.user?.email;
              if (!profileRes.data?.email_notifications || !email) return;

              return sendNotificationEmail({
                recipientUserId: u.id,
                recipientEmail: email,
                actorUsername,
                type: "mention",
                content: post.description!,
                postId: id,
                postTitle: (post.title as string) ?? null,
                idempotencyKey: `mention-post/${id}/${u.id}`,
              });
            })
            .catch(() => {});
        }
      }
    }
  }

  return NextResponse.json(post);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
