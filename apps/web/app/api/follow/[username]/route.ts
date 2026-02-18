import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ username: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: target } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.id === user.id) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: target.id,
  });

  if (error) {
    // Unique constraint → already following
    if (error.code === "23505") {
      return NextResponse.json({ following: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert follow notification (fire-and-forget)
  await supabase.from("notifications").insert({
    user_id: target.id,
    actor_id: user.id,
    type: "follow",
  });

  return NextResponse.json({ following: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: target } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", target.id);

  return NextResponse.json({ following: false });
}
