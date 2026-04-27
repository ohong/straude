import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit("social", user.id, { limit: 30 });
  if (limited) return limited;

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (commentError) {
    return NextResponse.json({ error: commentError.message }, { status: 500 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const { error } = await supabase.from("comment_reactions").insert({
    user_id: user.id,
    comment_id: id,
  });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("comment_reactions")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", id);

  return NextResponse.json({ reacted: true, count: count ?? 0 });
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

  await supabase
    .from("comment_reactions")
    .delete()
    .eq("user_id", user.id)
    .eq("comment_id", id);

  const { count } = await supabase
    .from("comment_reactions")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", id);

  return NextResponse.json({ reacted: false, count: count ?? 0 });
}
