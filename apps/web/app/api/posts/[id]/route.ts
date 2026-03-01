import { NextResponse, type NextRequest } from "next/server";
import { after } from "@/lib/utils/after";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { parseMentions } from "@/lib/utils/mentions";
import { sendNotificationEmail } from "@/lib/email/send-comment-email";
import { checkAndAwardAchievements } from "@/lib/achievements";

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

  // Fetch current post state before applying updates (for enrichment detection)
  const { data: currentPost } = await supabase
    .from("posts")
    .select("title, description")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

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

  // Defer non-blocking work after the response is sent
  after(async () => {
    // Photo achievement — when images were added
    if (body.images !== undefined && Array.isArray(post.images) && post.images.length > 0) {
      checkAndAwardAchievements(user.id, "photo").catch(() => {});
    }

    // Award streak freeze when enriching a bare post (first time adding title or description)
    const wasBare = currentPost && currentPost.title === null && currentPost.description === null;
    const isEnriching = wasBare && (body.title || body.description);
    if (isEnriching) {
      const db = getServiceClient();
      db.rpc("increment_streak_freezes", { p_user_id: user.id, p_max: 7 }).then(() => {}, () => {});
    }

    // Mention notifications — only when description was actually changed
    if (body.description !== undefined && post.description) {
      const mentionedUsernames = parseMentions(post.description);
      if (mentionedUsernames.length > 0) {
        const db = getServiceClient();
        const { data: mentionedUsers } = await db
          .from("users")
          .select("id, username")
          .in("username", mentionedUsernames);

        const candidates = (mentionedUsers ?? []).filter(
          (u) => u.id !== user.id,
        );

        if (candidates.length > 0) {
          // Deduplicate: skip users who already have a mention notification for this post.
          // Must use service client — RLS restricts notification reads to the owner,
          // so the post author can't see other users' notifications for dedup.
          const { data: existingNotifs, error: dedupError } = await db
            .from("notifications")
            .select("user_id")
            .eq("type", "mention")
            .eq("post_id", id)
            .in("user_id", candidates.map((u) => u.id));

          if (dedupError) {
            console.error("[notifications] dedup query failed, skipping:", dedupError.message);
            return;
          }

          const alreadyNotified = new Set(
            (existingNotifs ?? []).map((n) => n.user_id),
          );
          const toNotify = candidates.filter((u) => !alreadyNotified.has(u.id));

          const mentionNotifs = toNotify.map((u) => ({
            user_id: u.id,
            actor_id: user.id,
            type: "mention" as const,
            post_id: id,
          }));

          if (mentionNotifs.length > 0) {
            const { error: insertError } = await db.from("notifications").insert(mentionNotifs);
            if (insertError) {
              console.error("[notifications] insert failed:", insertError.message);
            }
          }

          // Fire mention emails
          if (toNotify.length > 0) {
            const { data: actor } = await db
              .from("users")
              .select("username")
              .eq("id", user.id)
              .single();
            const actorUsername = actor?.username ?? "Someone";

            for (const u of toNotify) {
              Promise.all([
                db
                  .from("users")
                  .select("email_mention_notifications")
                  .eq("id", u.id)
                  .single(),
                db.auth.admin.getUserById(u.id),
              ])
                .then(([profileRes, authRes]) => {
                  const email = authRes.data?.user?.email;
                  if (!profileRes.data?.email_mention_notifications || !email) return;

                  return sendNotificationEmail({
                    recipientUserId: u.id,
                    recipientEmail: email,
                    actorUsername,
                    type: "post_mention",
                    content: post.description!,
                    postId: id,
                    postTitle: (post.title as string) ?? null,
                    idempotencyKey: `mention-post/${id}/${u.id}`,
                  });
                })
                .catch((err) => console.error("[email] mention notification failed:", err));
            }
          }
        }
      }
    }
  });

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
