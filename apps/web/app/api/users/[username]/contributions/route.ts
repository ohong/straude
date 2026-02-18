import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Look up user
  const { data: profile } = await supabase
    .from("users")
    .select("id, is_public")
    .eq("username", username)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // For private profiles, only the owner or followers can view contribution data
  if (!profile.is_public) {
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (authUser.id !== profile.id) {
      const { data: follow } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", authUser.id)
        .eq("following_id", profile.id)
        .maybeSingle();
      if (!follow) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // Last 52 weeks of data
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364); // 52 weeks
  const startStr = startDate.toISOString().split("T")[0];

  const { data: usage } = await supabase
    .from("daily_usage")
    .select("date, cost_usd")
    .eq("user_id", profile.id)
    .gte("date", startStr)
    .order("date", { ascending: true });

  const { data: posts } = await supabase
    .from("posts")
    .select("daily_usage_id, daily_usage:daily_usage!posts_daily_usage_id_fkey(date)")
    .eq("user_id", profile.id);

  const postDates = new Set(
    (posts ?? []).map((p) => {
      const du = p.daily_usage as unknown as { date: string } | null;
      return du?.date;
    }).filter(Boolean)
  );

  const data = (usage ?? []).map((d) => ({
    date: d.date,
    cost_usd: Number(d.cost_usd),
    has_post: postDates.has(d.date),
  }));

  // Compute streak
  const { data: streakData } = await supabase.rpc("calculate_user_streak", {
    p_user_id: profile.id,
  });
  const streak = typeof streakData === "number" ? streakData : 0;

  return NextResponse.json({ data, streak });
}
