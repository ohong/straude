import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ username: string }> };

async function changeFollow(context: RouteContext, action: "follow" | "unfollow") {
  const { username } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "follow") {
    const limited = await rateLimit("social", user.id, { limit: 30 });
    if (limited) return limited;
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

  const { data, error } = await getServiceClient().rpc("change_follow", {
    p_actor: user.id, p_target: target.id, p_action: action,
  });
  if (error) return NextResponse.json({ error: "Could not update follow status" }, { status: 500 });
  return NextResponse.json({ following: data === "following", requested: data === "requested" });
}

export function POST(_request: NextRequest, context: RouteContext) {
  return changeFollow(context, "follow");
}

export function DELETE(_request: NextRequest, context: RouteContext) {
  return changeFollow(context, "unfollow");
}
