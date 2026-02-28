import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().replace(/[,()\\]/g, "");

  // Step 1: get IDs of users the current user follows
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = (follows ?? []).map((f) => f.following_id);

  if (followingIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  // Step 2: filter followed users by search term
  let query = supabase
    .from("users")
    .select("id, username, display_name, avatar_url")
    .in("id", followingIds)
    .not("username", "is", null)
    .limit(8);

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data: users } = await query;

  return NextResponse.json({ users: users ?? [] });
}
