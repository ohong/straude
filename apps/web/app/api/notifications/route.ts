import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = new Set(["follow", "kudos", "comment", "mention"]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const typeParam = url.searchParams.get("type");
  const typeFilter = typeParam && VALID_TYPES.has(typeParam) ? typeParam : null;

  let query = supabase
    .from("notifications")
    .select("*, actor:users!notifications_actor_id_fkey(username, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  let countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  const [notificationsRes, unreadRes] = await Promise.all([query, countQuery]);

  if (notificationsRes.error || unreadRes.error) {
    return NextResponse.json(
      { error: notificationsRes.error?.message ?? unreadRes.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    notifications: notificationsRes.data ?? [],
    unread_count: unreadRes.count ?? 0,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.all) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .in("id", body.ids);
  } else {
    return NextResponse.json({ error: "Provide { all: true } or { ids: [...] }" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
