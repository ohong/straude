import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post, error } = await supabase
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

  if (error || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let has_kudosed = false;
  if (user) {
    const { data: kudos } = await supabase
      .from("kudos")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", id)
      .maybeSingle();
    has_kudosed = !!kudos;
  }

  return NextResponse.json({
    ...post,
    kudos_count: post.kudos_count?.[0]?.count ?? 0,
    comment_count: post.comment_count?.[0]?.count ?? 0,
    has_kudosed,
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
    if (typeof body.title !== "string" || body.title.length > 100) {
      return NextResponse.json(
        { error: "Title must be a string of at most 100 characters" },
        { status: 400 }
      );
    }
    updates.title = body.title;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 500) {
      return NextResponse.json(
        { error: "Description must be a string of at most 500 characters" },
        { status: 400 }
      );
    }
    updates.description = body.description;
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > 4) {
      return NextResponse.json(
        { error: "Images must be an array of at most 4 URLs" },
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
