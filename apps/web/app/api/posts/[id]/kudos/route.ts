import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardAchievements } from "@/lib/achievements";

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

  const { error } = await supabase.from("kudos").insert({
    user_id: user.id,
    post_id: id,
  });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch post owner for notifications and achievements (deferred after response)
  if (!error) {
    after(async () => {
      const { data: post } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", id)
        .single();

      // Insert kudos notification (skip self-kudos)
      if (post && post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: "kudos",
          post_id: id,
        });
      }

      // Award social achievements (only on INSERT not DELETE)
      checkAndAwardAchievements(user.id, "kudos").catch(() => {});
      if (post && post.user_id !== user.id) {
        checkAndAwardAchievements(post.user_id, "kudos").catch(() => {});
      }
    });
  }

  const { count } = await supabase
    .from("kudos")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id);

  return NextResponse.json({ kudosed: true, count: count ?? 0 });
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
    .from("kudos")
    .delete()
    .eq("user_id", user.id)
    .eq("post_id", id);

  const { count } = await supabase
    .from("kudos")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id);

  return NextResponse.json({ kudosed: false, count: count ?? 0 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  let query = supabase
    .from("kudos")
    .select("*, user:users!kudos_user_id_fkey(*)")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: kudos, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (kudos ?? []).map((k) => k.user);
  const next_cursor =
    (kudos ?? []).length === limit
      ? kudos![kudos!.length - 1]?.created_at
      : undefined;

  return NextResponse.json({ users, next_cursor });
}
